#!/usr/bin/env node
/**
 * load-test.js
 * Prueba de rendimiento para POST /api/v1/leads/draft
 * - Genera N peticiones (TOTAL, por defecto 1000)
 * - Concurrencia configurable (CONC, por defecto 50)
 * - Porcentaje de duplicados (DUP_RATIO, por defecto 0.2 -> 20%)
 * - Pool de combos duplicables (POOL_SIZE, por defecto 100)
 * - URL objetivo (TARGET_URL, por defecto http://localhost:3010/api/v1/leads/draft)
 *
 * Ejemplo:
 *   TARGET_URL=http://localhost:3010/api/v1/leads/draft TOTAL=1000 CONC=100 DUP_RATIO=0.3 node load-test.js
 */

import { performance } from 'node:perf_hooks';

const TARGET_URL = process.env.TARGET_URL || 'http://localhost:3010/api/v1/leads/draft';
const TOTAL = parseInt(process.env.TOTAL || '10000', 10);
const CONC = parseInt(process.env.CONC || '50', 10);
const DUP_RATIO = Math.min(Math.max(parseFloat(process.env.DUP_RATIO || '0.2'), 0), 1);
const POOL_SIZE = parseInt(process.env.POOL_SIZE || '100', 10);

// --- Helpers de random ---
const rndInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const pick = (arr) => arr[rndInt(0, arr.length - 1)];
const randDigits = (n) => Array.from({ length: n }, () => rndInt(0, 9)).join('');
const slug = () => Math.random().toString(36).slice(2, 10);

// Datos de ejemplo
const NAMES = ['Pedro', 'María', 'Juan', 'Luisa', 'Carlos', 'Ana', 'David', 'Sofía', 'Andrés', 'Valentina', 'Felipe', 'Camila'];
const LAST = ['Pérez', 'Gómez', 'López', 'Rodríguez', 'Martínez', 'García', 'Hernández', 'Ramírez', 'Torres', 'Vargas', 'Ríos', 'Castro'];
const STATES = ['Antioquia', 'Atlántico', 'Cundinamarca', 'Valle del Cauca', 'Bolívar', 'Santander', 'Risaralda'];
const CITIES = ['Medellín', 'Barranquilla', 'Bogotá', 'Cali', 'Cartagena', 'Bucaramanga', 'Pereira', 'Candelaria', 'Alejandría'];
const DOMAINS = ['melon-sa.site', 'posy.shop', 'domiburguer.com'];
const SECTION_POOL = Array.from({ length: 15 }, () => 'section-' + slug());
const PRODUCTS = [
    { name: 'RTAFULL pague 2 lleva 3', price: 159800, currency: 'COP' },
    { name: 'Gel Reductor x2 + 1', price: 129900, currency: 'COP' },
    { name: 'Kit Crioterapia', price: 189900, currency: 'COP' }
];

function makeName() {
    return `${pick(NAMES)} ${pick(LAST)} ${pick(LAST)}`;
}

function makePhone() {
    // E.164 colombiano simple: +57 + 9 dígitos
    return `+57${randDigits(9)}`;
}

function makeEmail() {
    return `${slug()}@test.com`;
}

function makeAddress() {
    return `calle ${rndInt(1, 199)} ${slug()}, punto ref ${slug()}`;
}

function buildUrl(domain) {
    return `https://${domain}/Rtafull/rtafull-${Date.now()}-${slug()}`;
}

// Un "combo" que define unicidad para dedupe: (domain, sectionId, phone)
function generateCombo() {
    return {
        domain: pick(DOMAINS),
        sectionId: pick(SECTION_POOL),
        phone: makePhone()
    };
}

// Preparamos un pool de combos para reutilizar y así forzar duplicados
const duplicatePool = Array.from({ length: Math.min(POOL_SIZE, TOTAL) }, generateCombo);

function makePayload(useDup = false) {
    let domain, sectionId, phone;
    if (useDup && duplicatePool.length > 0) {
        const c = pick(duplicatePool);
        ({ domain, sectionId, phone } = c);
    } else {
        const c = generateCombo();
        ({ domain, sectionId, phone } = c);
        // De vez en cuando agregamos nuevos combos al pool para más variedad de duplicados
        if (duplicatePool.length < POOL_SIZE && Math.random() < 0.3) duplicatePool.push(c);
    }

    const state = pick(STATES);
    const city = pick(CITIES);
    const prod = pick(PRODUCTS);

    return {
        name: makeName(),
        phone,
        email: makeEmail(),
        country: 'CO',
        state,
        city,
        address: makeAddress(),
        sectionId,
        domain,
        url: buildUrl(domain),
        products: [prod],
        idStore: rndInt(7000, 8000)
    };
}

// Enviamos una sola petición
async function sendOne(i) {
    // Decide si esta petición será duplicada
    const useDup = Math.random() < DUP_RATIO;
    const payload = makePayload(useDup);

    const t0 = performance.now();
    let ok = false;
    let status = 0;
    let errorText = null;

    try {
        const res = await fetch(TARGET_URL, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(payload),
            // Mantener conexión: fetch de Node 18 (undici) ya usa keep-alive
        });
        status = res.status;
        ok = res.ok;
        if (!ok) {
            // Leemos un poco del error (sin saturar memoria)
            const txt = await res.text();
            errorText = txt.slice(0, 300);
        }
    } catch (err) {
        status = -1;
        errorText = (err && err.message) ? err.message : String(err);
    }

    const t1 = performance.now();
    return { ms: t1 - t0, ok, status, errorText };
}

async function main() {
    console.log(`Target: ${TARGET_URL}`);
    console.log(`TOTAL=${TOTAL}  CONC=${CONC}  DUP_RATIO=${DUP_RATIO}  POOL_SIZE=${POOL_SIZE}`);

    const tGlobal0 = performance.now();

    // Scheduler simple con "CONC" workers
    let next = 0;
    const results = [];
    const statusCount = new Map();
    const errors = [];

    async function worker(id) {
        while (true) {
            const i = next++;
            if (i >= TOTAL) break;
            const r = await sendOne(i);
            results[i] = r;
            statusCount.set(r.status, (statusCount.get(r.status) || 0) + 1);
            if (!r.ok) {
                errors.push({ i, status: r.status, errorText: r.errorText });
            }
            if ((i + 1) % 100 === 0) {
                console.log(`[Progreso] ${i + 1}/${TOTAL}`);
            }
        }
    }

    await Promise.all(Array.from({ length: CONC }, (_, k) => worker(k)));

    const tGlobal1 = performance.now();

    // Métricas
    const lat = results.map(r => r.ms).filter(Number.isFinite).sort((a, b) => a - b);
    const sum = lat.reduce((a, b) => a + b, 0);
    const avg = lat.length ? (sum / lat.length) : 0;
    const p = (x) => {
        if (!lat.length) return 0;
        const idx = Math.floor(x * (lat.length - 1));
        return lat[idx];
    };

    console.log('\n=== RESULTADOS ===');
    console.log(`Tiempo total: ${(tGlobal1 - tGlobal0).toFixed(0)} ms`);
    console.log(`Enviadas: ${TOTAL}`);
    console.log(`OK: ${results.filter(r => r.ok).length}`);
    console.log(`Fallidas: ${results.filter(r => !r.ok).length}`);
    console.log('Status codes:');
    for (const [k, v] of [...statusCount.entries()].sort((a, b) => a[0] - b[0])) {
        console.log(`  ${k}: ${v}`);
    }
    console.log('Latencias (ms):');
    console.log(`  p50: ${p(0.50).toFixed(2)}`);
    console.log(`  p90: ${p(0.90).toFixed(2)}`);
    console.log(`  p95: ${p(0.95).toFixed(2)}`);
    console.log(`  p99: ${p(0.99).toFixed(2)}`);
    console.log(`  avg: ${avg.toFixed(2)}`);

    if (errors.length) {
        console.log('\nAlgunos errores (máx 5):');
        for (const e of errors.slice(0, 5)) {
            console.log(`  #${e.i} status=${e.status} err="${e.errorText}"`);
        }
    }
}

main().catch(err => {
    console.error('Fallo en la prueba:', err);
    process.exit(1);
});
