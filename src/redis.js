// src/redis.js
import { createClient } from 'redis';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
export const redis = createClient({ url: REDIS_URL });
redis.on('error', (e) => console.error('[Redis] error:', e));
await redis.connect();

const DUE = 'debounce:due';
const PROC = 'debounce:processing';
const JOB_KEY = (id) => `debounce:job:${id}`;

// --- enqueue idéntico a tu versión actual ---
export async function enqueueDebounced(id, payload, delayMs = 15 * 60 * 1000) {
    const due = Date.now() + delayMs;
    const data = JSON.stringify(payload ?? null);

    await redis
        .multi()
        .hSet(JOB_KEY(id), { payload: data, due: String(due) })
        .zAdd(DUE, [{ score: due, value: id }])
        .exec();
}

// --- LUA: claim atómico (due -> processing con visibilidad) ---
const CLAIM_LUA = `
local due = KEYS[1]
local proc = KEYS[2]
local now = tonumber(ARGV[1])
local vt  = tonumber(ARGV[2])
local batch = tonumber(ARGV[3])
local moved = {}
for i=1,batch do
  local z = redis.call('ZRANGE', due, 0, 0, 'WITHSCORES')
  if (not z[1]) then break end
  local id = z[1]
  local score = tonumber(z[2])
  if score > now then break end
  local rem = redis.call('ZREM', due, id)
  if rem == 1 then
    redis.call('ZADD', proc, now + vt, id)
    table.insert(moved, id)
  end
end
return moved
`;

async function claimDueBatch({ batch = 50, visibilityMs = 30_000 } = {}) {
    const now = Date.now();
    const ids = await redis.eval(CLAIM_LUA, {
        keys: [DUE, PROC],
        arguments: [String(now), String(visibilityMs), String(batch)],
    });
    return ids; // array de IDs reclamados
}

// --- ACK: quitar de processing ---
async function ackProcessing(id) {
    await redis.zRem(PROC, id);
}

// --- Requeue expirados: processing -> due cuando vence visibilidad ---
const REQUEUE_LUA = `
local proc = KEYS[1]
local due  = KEYS[2]
local now  = tonumber(ARGV[1])
local batch = tonumber(ARGV[2])
local reclaimed = {}
local ids = redis.call('ZRANGEBYSCORE', proc, '-inf', now, 'LIMIT', 0, batch)
for _, id in ipairs(ids) do
  local rem = redis.call('ZREM', proc, id)
  if rem == 1 then
    redis.call('ZADD', due, now, id)
    table.insert(reclaimed, id)
  end
end
return reclaimed
`;

async function requeueExpired({ batch = 200 } = {}) {
    const now = Date.now();
    return redis.eval(REQUEUE_LUA, {
        keys: [PROC, DUE],
        arguments: [String(now), String(batch)],
    });
}

// --- Worker con visibilidad y reclaimer ---
export async function runDebounceWorker(
    processJobFn,
    { batch = 50, idleMs = 500, visibilityMs = 30_000, requeueSweepMs = 5_000 } = {}
) {
    // barrido periódico de "processing" vencido
    setInterval(() => requeueExpired().catch(() => { }), requeueSweepMs);

    for (; ;) {
        const ids = await claimDueBatch({ batch, visibilityMs });

        if (!ids || ids.length === 0) {
            await new Promise((r) => setTimeout(r, idleMs));
            continue;
        }

        for (const id of ids) {
            const job = await redis.hGetAll(JOB_KEY(id));
            const now = Date.now();
            const due = Number(job.due || 0);

            // Si llegó un evento más nuevo (debounce extendido), reprograma y ACKea este intento
            if (due > now) {
                await redis
                    .multi()
                    .zAdd(DUE, [{ score: due, value: id }])
                    .zRem(PROC, id)
                    .exec();
                continue;
            }

            let payload = null;
            try { payload = job.payload ? JSON.parse(job.payload) : null; } catch { }

            try {
                await processJobFn({ id, payload });
                await ackProcessing(id);
                await redis.expire(JOB_KEY(id), 3600); // opcional: conservar 1h
            } catch (err) {
                console.error('[Worker] Error procesando', id, err);
                // Reintento simple: backoff de 60s
                const next = now + 60_000;
                await redis
                    .multi()
                    .zAdd(DUE, [{ score: next, value: id }])
                    .zRem(PROC, id)
                    .exec();

                // Opcional: contar intentos
                await redis.hIncrBy(JOB_KEY(id), 'retries', 1);
            }
        }
    }
}
