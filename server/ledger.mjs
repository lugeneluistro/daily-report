// The expense ledger behind the Budget card and the Telegram bot.
//
// One JSON file, written atomically (temp file + rename) and only ever touched
// through `update()`, which runs one change at a time. It lives in /data, which
// .gitignore keeps out of git — it is personal financial data and must never be
// committed or served from /public.
//
// The bot's Telegram `update_id` is stored in the same file as the expenses it
// produced, so a crash can never log an expense twice or lose one.

import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
export const DEFAULT_LEDGER_PATH = join(__dirname, '..', 'data', 'budget.json');

/** Starting limits in pesos per month. Change them from Telegram with /limit. */
const DEFAULT_LIMITS = {
    total: 35000,
    categories: { Groceries: 8000, Transport: 3500, Dining: 4000, Utilities: 6000, Savings: 9000 },
};

/** The catch-all. It never has a limit and always exists. */
export const OTHER = 'Other';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const RECENT_COUNT = 3;
/** Before this day of the month the note states what is left instead of projecting. */
const PACE_FROM_DAY = 7;

const pad2 = (n) => String(n).padStart(2, '0');
export const round2 = (n) => Math.round(n * 100) / 100;

/** 245 -> ₱245, 245.5 -> ₱245.50, 28450 -> ₱28,450 */
export const peso = (n) => `₱${n.toLocaleString('en-US', { minimumFractionDigits: Number.isInteger(n) ? 0 : 2, maximumFractionDigits: 2 })}`;

export const todayKey = (clock) => `${clock.year}-${pad2(clock.month)}-${pad2(clock.day)}`;

function freshState() {
    return { version: 1, lastUpdateId: 0, limits: structuredClone(DEFAULT_LIMITS), expenses: [] };
}

/** Accepts whatever is on disk and returns a state the rest of the code can trust. */
function normalise(raw) {
    const base = freshState();
    const limits = raw?.limits ?? {};
    const categories = limits.categories && typeof limits.categories === 'object' ? limits.categories : base.limits.categories;
    return {
        version: 1,
        lastUpdateId: Number.isInteger(raw?.lastUpdateId) ? raw.lastUpdateId : 0,
        limits: {
            total: Number.isFinite(limits.total) && limits.total > 0 ? limits.total : base.limits.total,
            categories: Object.fromEntries(Object.entries(categories).filter(([name, v]) => name && Number.isFinite(v) && v > 0)),
        },
        expenses: (Array.isArray(raw?.expenses) ? raw.expenses : []).filter(
            (e) => e && typeof e.id === 'string' && Number.isFinite(e.amount) && e.amount > 0 && /^\d{4}-\d{2}-\d{2}$/.test(e.date) && typeof e.category === 'string',
        ),
    };
}

/**
 * A ledger on disk. `update(fn)` hands `fn` a copy of the state, saves the copy
 * if `fn` returns, and then makes it current — so a failed write leaves memory
 * and disk agreeing. `read(fn)` never writes.
 */
export function createLedger(filePath = DEFAULT_LEDGER_PATH, log = console) {
    let state = null;
    let chain = Promise.resolve();

    async function load() {
        let text;
        try {
            text = await readFile(filePath, 'utf-8');
        } catch (err) {
            if (err.code === 'ENOENT') return freshState();
            throw err;
        }
        try {
            return normalise(JSON.parse(text));
        } catch (err) {
            // Never overwrite something we couldn't read — set it aside and say so.
            const aside = `${filePath}.corrupt-${Date.now()}`;
            await rename(filePath, aside);
            log.error(`[budget] ${filePath} was not valid JSON (${err.message}). Moved it to ${aside} and started a new ledger.`);
            return freshState();
        }
    }

    async function persist(next) {
        await mkdir(dirname(filePath), { recursive: true });
        const tmp = `${filePath}.tmp`;
        await writeFile(tmp, JSON.stringify(next, null, 2) + '\n', 'utf-8');
        await rename(tmp, filePath);
    }

    function queue(task) {
        const run = chain.then(task);
        chain = run.catch(() => {}); // one failure must not jam the queue
        return run;
    }

    return {
        filePath,
        update: (mutator) =>
            queue(async () => {
                state ??= await load();
                const next = structuredClone(state);
                const result = mutator(next);
                await persist(next);
                state = next;
                return result;
            }),
        read: (reader) =>
            queue(async () => {
                state ??= await load();
                return reader(structuredClone(state));
            }),
    };
}

// ---- changes (each takes the state copy from update() and mutates it) ----

/** Adds expenses from one Telegram update. Safe to call twice for the same update. */
export function addExpenses(state, entries, { updateId, source, photoFileId = null, loggedAt }) {
    const added = [];
    entries.forEach((entry, i) => {
        const id = `tg-${updateId}-${i}`;
        if (state.expenses.some((e) => e.id === id)) return;
        const expense = { id, updateId, ...entry, source, photoFileId, loggedAt };
        state.expenses.push(expense);
        added.push(expense);
    });
    return added;
}

/** Removes everything logged by the most recent message. */
export function undoLast(state) {
    const last = state.expenses[state.expenses.length - 1];
    if (!last) return [];
    const removed = state.expenses.filter((e) => e.updateId === last.updateId);
    state.expenses = state.expenses.filter((e) => e.updateId !== last.updateId);
    return removed;
}

/** Case-insensitive match against the configured categories; returns the stored spelling or null. */
export function findCategory(state, name) {
    const wanted = name.trim().toLowerCase();
    return Object.keys(state.limits.categories).find((c) => c.toLowerCase() === wanted) ?? null;
}

// ---- the month, as the dashboard and the bot both show it ----

/** `clock` is manilaNow(). */
export function summarizeMonth(state, clock) {
    const monthKey = `${clock.year}-${pad2(clock.month)}`;
    const inMonth = state.expenses.filter((e) => e.date.startsWith(monthKey));

    const spentBy = {};
    for (const e of inMonth) spentBy[e.category] = round2((spentBy[e.category] ?? 0) + e.amount);

    const configured = Object.keys(state.limits.categories);
    const names = [...configured, ...Object.keys(spentBy).filter((n) => !configured.includes(n))];
    const categories = names.map((name) => ({ name, spent: spentBy[name] ?? 0, limit: state.limits.categories[name] ?? null })).filter((c) => c.limit !== null || c.spent > 0); // "Other" and removed categories only appear once they hold money

    const totalSpent = round2(inMonth.reduce((sum, e) => sum + e.amount, 0));
    const totalLimit = state.limits.total;
    const daysInMonth = new Date(Date.UTC(clock.year, clock.month, 0)).getUTCDate();
    const over = categories.filter((c) => c.limit !== null && c.spent > c.limit).map((c) => c.name);

    return {
        monthLabel: MONTHS[clock.month - 1],
        totalSpent,
        totalLimit,
        daysLeftInMonth: daysInMonth - clock.day,
        categories,
        note: paceNote({ totalSpent, totalLimit, day: clock.day, daysInMonth, over }),
        entriesThisMonth: inMonth.length,
        recent: state.expenses
            .slice(-RECENT_COUNT)
            .reverse()
            .map((e) => ({ id: e.id, date: e.date, merchant: e.merchant, category: e.category, amount: e.amount })),
        asOf: new Date().toISOString(),
    };
}

function paceNote({ totalSpent, totalLimit, day, daysInMonth, over }) {
    const parts = [];
    if (over.length > 0) parts.push(`Over budget: ${over.join(', ')}.`);
    if (totalSpent === 0) {
        parts.push('Nothing logged yet this month — message the bot to add an expense.');
    } else if (day < PACE_FROM_DAY) {
        // Early on, one big purchase (groceries, a bill) makes any projection nonsense.
        const left = round2(totalLimit - totalSpent);
        parts.push(left >= 0 ? `${peso(left)} left of the ${peso(totalLimit)} limit.` : `Already ${peso(-left)} over the ${peso(totalLimit)} limit.`);
    } else {
        const projected = Math.round((totalSpent / day) * daysInMonth);
        parts.push(
            projected > totalLimit ? `At this pace the month ends near ${peso(projected)}, over the ${peso(totalLimit)} limit.` : `On pace for about ${peso(projected)} of ${peso(totalLimit)}.`,
        );
    }
    return parts.join(' ');
}
