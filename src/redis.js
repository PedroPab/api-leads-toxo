import { createClient } from 'redis';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const client = createClient({ url: REDIS_URL });
client.on('error', (e) => console.error('Redis error:', e));

(async () => {
    await client.connect();
})();

const ZSET_KEY = 'debounce:due';           // score = timestamp (ms) cuando debe ejecutarse
const JOB_KEY = (id) => `debounce:job:${id}`;

export async function enqueueDebounced(id, payload, delayMs = 15 * 60 * 1000) {
    const due = Date.now() + delayMs;
    const data = JSON.stringify(payload ?? null);

    await client
        .multi()
        .hSet(JOB_KEY(id), { payload: data, due: String(due) })
        .zAdd(ZSET_KEY, [{ score: due, value: id }])
        .exec();
}
export async function runWorker(processJobFn, { batch = 50, idleMs = 500 } = {}) {
    for (; ;) {
        const now = Date.now();

        // Trae IDs vencidos (hasta batch)
        const ids = await client.zRangeByScore(ZSET_KEY, 0, now, { LIMIT: { offset: 0, count: batch } });
        if (ids.length === 0) {
            await new Promise(r => setTimeout(r, idleMs));
            continue;
        }

        for (const id of ids) {
            // Intento de "claim": eliminar del ZSET (si otro worker ya lo tomó, removed=0)
            const removed = await client.zRem(ZSET_KEY, id);
            if (!removed) continue;

            const job = await client.hGetAll(JOB_KEY(id));
            const due = Number(job.due || 0);

            // Si fue reprogramado mientras lo listábamos, reinsertar y saltar
            if (due > now) {
                await client.zAdd(ZSET_KEY, [{ score: due, value: id }]);
                continue;
            }

            let payload = null;
            try { payload = job.payload ? JSON.parse(job.payload) : null; } catch { }

            try {
                await processJobFn({ id, payload });
                // Limpieza opcional: conservar por 1h para auditoría y luego expirar
                await client.expire(JOB_KEY(id), 3600);
            } catch (err) {
                console.error('Error procesando', id, err);
                // Aquí puedes reintentar o enviar a una DLQ.
            }
        }
    }
}
