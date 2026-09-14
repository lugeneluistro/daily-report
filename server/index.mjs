// Local always-on backend for the night brief. Binds to 127.0.0.1 only — this
// is never reachable from another machine, by design (confirmed: dashboard is
// only ever viewed from this same PC). Kept alive by PM2; see
// ecosystem.config.cjs and the setup notes in the project chat.
//
// Runs the same pipeline as `npm run brief`, just triggerable on demand
// (POST /api/brief/refresh) and on an internal schedule, instead of only
// once a day via GitHub Actions.

import express from 'express';
import cors from 'cors';
import cron from 'node-cron';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';

import { generateBrief, OUTPUT_PATH } from '../scripts/brief/run.mjs';
import { checkBillingAlert } from '../scripts/brief/billing.mjs';

const PORT = 4700;
const HOST = '127.0.0.1';

let cached = null;
let generating = null; // in-flight promise, so concurrent refresh calls share one run

async function runGeneration() {
    if (generating) return generating; // don't fire two LLM calls at once

    generating = (async () => {
        const brief = await generateBrief();
        await mkdir(dirname(OUTPUT_PATH), { recursive: true });
        await writeFile(OUTPUT_PATH, JSON.stringify(brief, null, 2) + '\n', 'utf-8');
        cached = brief;
        console.log(`[${new Date().toISOString()}] Generated brief, wrote ${OUTPUT_PATH}`);
        await checkBillingAlert(brief.claimekBilling);
        return brief;
    })();

    try {
        return await generating;
    } finally {
        generating = null;
    }
}

async function readFromDisk() {
    try {
        return JSON.parse(await readFile(OUTPUT_PATH, 'utf-8'));
    } catch {
        return null;
    }
}

const app = express();
// Safe to leave open: the loopback bind below already makes this socket
// unreachable from any other machine. CORS here only controls which page's
// JS may read the response, not who can reach the port.
app.use(cors());

app.get('/api/brief', async (_req, res) => {
    res.set('Cache-Control', 'no-store');
    const brief = cached ?? (await readFromDisk());
    if (!brief) return res.status(503).json({ error: 'no brief generated yet' });
    res.json(brief);
});

app.post('/api/brief/refresh', async (_req, res) => {
    res.set('Cache-Control', 'no-store');
    try {
        const brief = await runGeneration();
        res.json(brief);
    } catch (err) {
        console.error('Refresh failed:', err);
        res.status(500).json({ error: err.message });
    }
});

// 09:00 UTC = 5PM Manila (PHT, UTC+8) — same timing as the GitHub Actions cron.
cron.schedule('0 17 * * *', () => runGeneration().catch((err) => console.error('Scheduled generation failed:', err)), { timezone: 'Asia/Manila' });

app.listen(PORT, HOST, () => {
    console.log(`Night brief server listening on http://${HOST}:${PORT}`);
    console.log('Scheduled for 5PM Asia/Manila daily. POST /api/brief/refresh to run it now.');
});
