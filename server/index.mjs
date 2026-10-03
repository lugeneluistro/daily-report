// Local always-on backend for the night brief. Binds to 127.0.0.1 only — this
// is never reachable from another machine, by design (confirmed: dashboard is
// only ever viewed from this same PC). Kept alive by PM2; see
// ecosystem.config.cjs and the setup notes in the project chat.
//
// Runs the same pipeline as `npm run brief`, just triggerable on demand
// (POST /api/brief/refresh) and on an internal schedule (5PM Manila daily).

import cors from 'cors';
import express from 'express';
import cron from 'node-cron';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

import { checkBillingAlert } from '../scripts/brief/billing.mjs';
import { generateBrief, OUTPUT_PATH } from '../scripts/brief/run.mjs';
import { manilaNow } from '../scripts/brief/sources.mjs';
import { createLedger, summarizeMonth } from './ledger.mjs';
import { startTelegramBot } from './telegram.mjs';

// The dashboard calls 4700, so only change this to run a second copy for testing.
const PORT = Number(process.env.NIGHT_BRIEF_PORT) || 4700;
const HOST = '127.0.0.1';

// Telegram expense bot (feeds the Budget card). Both come from the user's
// environment variables; without a token the bot simply doesn't start.
const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;
// data/budget.json by default (gitignored). BUDGET_LEDGER_PATH moves it, e.g. somewhere that gets backed up.
const ledger = createLedger(process.env.BUDGET_LEDGER_PATH || undefined);

// Pages allowed to talk to this server: anything on this machine (the dev
// server, a preview build), plus any extra origins listed in DASHBOARD_ORIGINS
// (comma-separated) — only needed if the dashboard is opened from a deployed URL.
const LOCAL_HOSTNAMES = new Set(['localhost', '127.0.0.1', '[::1]']);
const EXTRA_ORIGINS = new Set(
    (process.env.DASHBOARD_ORIGINS ?? '')
        .split(',')
        .map((o) => o.trim().replace(/\/$/, ''))
        .filter(Boolean),
);

function isAllowedOrigin(origin) {
    if (EXTRA_ORIGINS.has(origin.replace(/\/$/, ''))) return true;
    try {
        return LOCAL_HOSTNAMES.has(new URL(origin).hostname);
    } catch {
        return false;
    }
}

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

// The loopback bind keeps other machines out, but not other *websites*: any page
// open in this browser can call http://127.0.0.1:4700, and with open CORS it
// could read your billing and spending. So refuse requests from foreign origins
// outright (this also stops a foreign page from triggering a refresh), and refuse
// foreign Host headers (DNS rebinding).
app.use((req, res, next) => {
    const host = (req.headers.host ?? '').replace(/:\d+$/, '');
    if (!LOCAL_HOSTNAMES.has(host)) return res.status(403).json({ error: 'forbidden host' });
    if (req.headers.origin && !isAllowedOrigin(req.headers.origin)) return res.status(403).json({ error: 'forbidden origin' });
    next();
});
app.use(cors({ origin: (origin, done) => done(null, !origin || isAllowedOrigin(origin)) }));

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

// The Budget card's numbers. Kept out of the brief (and out of brief.json, which
// is tracked by git): they come straight from the local expense ledger, so the
// card updates the moment you log something, with no model call.
app.get('/api/budget', async (_req, res) => {
    res.set('Cache-Control', 'no-store');
    if (!TELEGRAM_TOKEN) return res.json({ configured: false });
    try {
        res.json({ configured: true, budget: await ledger.read((state) => summarizeMonth(state, manilaNow())) });
    } catch (err) {
        console.error('Budget read failed:', err);
        res.status(500).json({ error: 'could not read the expense ledger' });
    }
});

// 5PM Manila, an hour before the WFH decision deadline.
cron.schedule('0 17 * * *', () => runGeneration().catch((err) => console.error('Scheduled generation failed:', err)), { timezone: 'Asia/Manila' });

let bot = null;

app.listen(PORT, HOST, () => {
    console.log(`Night brief server listening on http://${HOST}:${PORT}`);
    console.log('Scheduled for 5PM Asia/Manila daily. POST /api/brief/refresh to run it now.');

    if (!TELEGRAM_TOKEN) {
        console.log('[telegram] expense bot off — set TELEGRAM_BOT_TOKEN (and TELEGRAM_CHAT_ID) to turn the Budget card into a real expense log.');
        return;
    }
    if (!process.env.ANTHROPIC_API_KEY) console.warn('[telegram] ANTHROPIC_API_KEY is not set — the bot cannot read expenses without it.');
    bot = startTelegramBot({ token: TELEGRAM_TOKEN, ownerChatId: TELEGRAM_CHAT_ID, ledger });
});

// PM2 and Ctrl+C both send SIGINT: end the open Telegram poll instead of leaving it dangling.
for (const signal of ['SIGINT', 'SIGTERM']) {
    process.on(signal, () => {
        bot?.stop();
        process.exit(0);
    });
}
