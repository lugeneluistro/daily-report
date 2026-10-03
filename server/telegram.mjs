// Telegram expense bot. It polls Telegram for new messages (long polling), so
// nothing has to reach this PC from the internet — it only makes outgoing calls.
//
// Only the owner's chat is ever acted on. Until TELEGRAM_CHAT_ID is set the bot is
// in setup mode: it replies with the sender's chat id and logs nothing.
//
// Each Telegram update is handled in one ledger write that both records its
// expenses and marks the update done, so a restart never double-logs a message.

import { manilaNow } from '../scripts/brief/sources.mjs';
import { cleanExpenses, parseExpenses } from './expenses.mjs';
import { addExpenses, findCategory, OTHER, peso, round2, summarizeMonth, todayKey, undoLast } from './ledger.mjs';

const DEFAULT_API_BASE = 'https://api.telegram.org';
const POLL_SECONDS = 25;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // the Claude API's per-image limit
const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp']);
const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const HELP = `Expense log. Tell me what you spent:
• jollibee 245
• lunch 180, grab 95
• or send a photo of the receipt

/month — this month so far
/undo — remove what your last message logged
/limit — show the monthly limits
/limit Groceries 8000 — set a category limit (a new name adds a category)
/limit total 40000 — the whole-month limit
/limit remove Health — drop a category`;

/** An error whose message is safe and useful to send straight back to the user. */
class UserError extends Error {}

class TelegramApiError extends Error {
    constructor(method, status, description) {
        super(`${method} failed (${status}${description ? `: ${description}` : ''})`);
        this.status = status;
    }
}

const dateLabel = (key) => `${MONTHS_SHORT[Number(key.slice(5, 7)) - 1]} ${Number(key.slice(8, 10))}`;

function standing(category) {
    if (category.limit === null) return `${category.name}: ${peso(category.spent)} this month`;
    const over = round2(category.spent - category.limit);
    return `${category.name}: ${peso(category.spent)} of ${peso(category.limit)}${over > 0 ? ` — over by ${peso(over)}` : ''}`;
}

function confirmation(added, state, clock) {
    const summary = summarizeMonth(state, clock);
    const monthKey = todayKey(clock).slice(0, 7);
    const lines = added.map((e) => {
        const who = [e.category, e.merchant].filter(Boolean).join(' · ');
        const when = e.date === todayKey(clock) ? '' : e.date.startsWith(monthKey) ? ` (${dateLabel(e.date)})` : ` (${dateLabel(e.date)} — not counted in ${summary.monthLabel})`;
        return `✓ Logged ${peso(e.amount)} · ${who}${when}`;
    });

    const touched = [...new Set(added.filter((e) => e.date.startsWith(monthKey)).map((e) => e.category))];
    for (const name of touched.slice(0, 3)) {
        const category = summary.categories.find((c) => c.name === name);
        if (category) lines.push(standing(category));
    }
    lines.push(`Month: ${peso(summary.totalSpent)} of ${peso(summary.totalLimit)}`);
    return lines.join('\n');
}

function monthText(state, clock) {
    const s = summarizeMonth(state, clock);
    const lines = [`${s.monthLabel} so far — ${peso(s.totalSpent)} of ${peso(s.totalLimit)}`];
    for (const c of s.categories) lines.push(standing(c));
    lines.push('', s.note);
    return lines.join('\n');
}

function limitsText(state) {
    const lines = [`Monthly limits — total ${peso(state.limits.total)}`];
    for (const [name, limit] of Object.entries(state.limits.categories)) lines.push(`${name}: ${peso(limit)}`);
    lines.push(`${OTHER}: no limit`);
    return lines.join('\n');
}

/** Pure: "Groceries 8000" / "total 40000" / "remove Health" / "" -> what to do. */
export function parseLimitArgs(args) {
    const text = args.trim();
    if (!text) return { kind: 'list' };

    const remove = text.match(/^remove\s+(.+)$/i);
    if (remove) return { kind: 'remove', name: remove[1].trim() };

    const set = text.match(/^(.+?)\s+₱?\s*(\d[\d,]*(?:\.\d+)?)$/);
    if (!set) return { kind: 'error', message: 'Use: /limit Groceries 8000, /limit total 40000 or /limit remove Health' };

    const amount = Number(set[2].replace(/,/g, ''));
    const name = set[1].trim();
    if (!(amount > 0) || amount >= 100_000_000) return { kind: 'error', message: 'That amount does not look right.' };
    if (!/^[\p{L}\p{N} &'-]{1,30}$/u.test(name)) return { kind: 'error', message: 'Category names can use letters, numbers, spaces, & and - (up to 30 characters).' };
    return { kind: 'set', name, amount };
}

function applyLimit(state, command) {
    if (command.kind === 'list') return limitsText(state);
    if (command.kind === 'error') return command.message;

    const existing = findCategory(state, command.name);

    if (command.kind === 'remove') {
        if (!existing) return `There is no category called ${command.name}.`;
        delete state.limits.categories[existing];
        return `Removed ${existing}. Entries already logged under it stay in your history.`;
    }

    if (command.name.toLowerCase() === 'total') {
        state.limits.total = command.amount;
        return `Whole-month limit set to ${peso(command.amount)}.`;
    }
    if (command.name.toLowerCase() === OTHER.toLowerCase()) return `${OTHER} is the catch-all and has no limit.`;

    if (existing) {
        state.limits.categories[existing] = command.amount;
        return `${existing} limit set to ${peso(command.amount)} a month.`;
    }
    const name = command.name.charAt(0).toUpperCase() + command.name.slice(1);
    state.limits.categories[name] = command.amount;
    return `Added ${name} at ${peso(command.amount)} a month. New expenses can now be filed under it.`;
}

/**
 * Starts polling. Returns { stop }.
 *
 * @param {object} options
 * @param {string} options.token            TELEGRAM_BOT_TOKEN
 * @param {string | undefined} options.ownerChatId  TELEGRAM_CHAT_ID; unset = setup mode
 * @param {ReturnType<import('./ledger.mjs').createLedger>} options.ledger
 */
export function startTelegramBot({ token, ownerChatId, ledger, parse = parseExpenses, apiBase = DEFAULT_API_BASE, clock = () => manilaNow(), log = console }) {
    const stopper = new AbortController();
    const strangers = new Set();
    const redact = (text) => String(text).split(token).join('<token>');
    const sleep = (ms) =>
        new Promise((resolve) => {
            const timer = setTimeout(resolve, ms);
            stopper.signal.addEventListener('abort', () => (clearTimeout(timer), resolve()), { once: true });
        });

    async function call(method, params = {}, timeoutMs = 15000) {
        let res;
        try {
            res = await fetch(`${apiBase}/bot${token}/${method}`, {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify(params),
                signal: AbortSignal.any([stopper.signal, AbortSignal.timeout(timeoutMs)]),
            });
        } catch (err) {
            throw new Error(redact(`${method} request failed: ${err.cause?.code ?? err.message}`));
        }
        const body = await res.json().catch(() => null);
        if (!res.ok || !body?.ok) throw new TelegramApiError(method, res.status, body?.description);
        return body.result;
    }

    const send = (chatId, text) => call('sendMessage', { chat_id: chatId, text });

    /** The receipt photo (largest size), or an image sent as a file. */
    async function downloadImage(message) {
        const photo = message.photo?.length ? message.photo[message.photo.length - 1] : null;
        const doc = message.document?.mime_type?.startsWith('image/') ? message.document : null;
        const source = photo ?? doc;
        if (!source) return null;

        if (doc && !IMAGE_TYPES.has(doc.mime_type)) throw new UserError('I can read JPEG, PNG, WebP and GIF images. Send it as a regular photo instead.');
        if (source.file_size > MAX_IMAGE_BYTES) throw new UserError('That image is over 5 MB. Send it as a regular photo (Telegram shrinks those).');

        const file = await call('getFile', { file_id: source.file_id });
        const res = await fetch(`${apiBase}/file/bot${token}/${file.file_path}`, { signal: AbortSignal.any([stopper.signal, AbortSignal.timeout(30000)]) });
        if (!res.ok) throw new Error(`image download failed (${res.status})`);
        const bytes = Buffer.from(await res.arrayBuffer());
        if (bytes.length > MAX_IMAGE_BYTES) throw new UserError('That image is over 5 MB. Send it as a regular photo (Telegram shrinks those).');

        return { mediaType: doc?.mime_type ?? 'image/jpeg', base64: bytes.toString('base64'), fileId: source.file_id };
    }

    /**
     * Decides what an update means. Returns null to ignore it, or a function
     * `(state) => reply | null` that runs inside the ledger write.
     */
    async function plan(update) {
        const message = update.message;
        if (!message || message.chat?.type !== 'private' || message.from?.is_bot) return null;
        const chatId = message.chat.id;

        if (!ownerChatId) {
            log.log(`[telegram] setup: chat id ${chatId} messaged the bot. Set TELEGRAM_CHAT_ID=${chatId} as an environment variable and restart the backend.`);
            return () =>
                `Hi! Your chat id is ${chatId}.\n\nTo finish setup, set it as the TELEGRAM_CHAT_ID environment variable on the PC running the backend, then restart the backend. After that, message me again.`;
        }
        if (String(chatId) !== String(ownerChatId)) {
            if (!strangers.has(chatId)) {
                strangers.add(chatId);
                log.warn('[telegram] ignoring messages from a chat that is not TELEGRAM_CHAT_ID');
            }
            return null;
        }

        const text = (message.text ?? message.caption ?? '').trim();
        const command = text.match(/^\/([a-z_]+)(?:@\w+)?(?:\s+([\s\S]*))?$/i);
        const now = clock();

        if (command) {
            const [, name, args = ''] = command;
            switch (name.toLowerCase()) {
                case 'start':
                case 'help':
                    return () => HELP;
                case 'month':
                    return (state) => monthText(state, now);
                case 'undo':
                    return (state) => {
                        const removed = undoLast(state);
                        if (removed.length === 0) return 'Nothing to undo.';
                        return removed.map((e) => `Removed ${peso(e.amount)} · ${[e.category, e.merchant].filter(Boolean).join(' · ')}`).join('\n');
                    };
                case 'limit':
                    return (state) => applyLimit(state, parseLimitArgs(args));
                default:
                    return () => 'I do not know that command. Send /help to see what I can do.';
            }
        }

        const hasImage = Boolean(message.photo?.length || message.document?.mime_type?.startsWith('image/'));
        if (!text && !hasImage) return () => 'Send me a short note like "jollibee 245", or a photo of a receipt.';

        const image = await downloadImage(message);
        const categories = [...(await ledger.read((s) => Object.keys(s.limits.categories))), OTHER];
        const today = todayKey(now);

        const { entries, question } = cleanExpenses(await parse({ text, image, categories, today }), { categories, today });
        if (entries.length === 0) return () => question ?? 'I could not find an amount in that. Try something like "jollibee 245".';

        return (state) => {
            const added = addExpenses(state, entries, { updateId: update.update_id, source: image ? 'photo' : 'text', photoFileId: image?.fileId ?? null, loggedAt: new Date().toISOString() });
            return added.length > 0 ? confirmation(added, state, now) : null;
        };
    }

    async function handleUpdate(update) {
        let apply;
        try {
            apply = await plan(update);
        } catch (err) {
            if (err instanceof UserError) apply = () => err.message;
            else {
                log.error(`[telegram] could not process update ${update.update_id}: ${redact(err.message)}`);
                apply = () => 'Sorry — I could not process that. Please try again in a moment.';
            }
        }

        // One write: the expenses (if any) and "this update is done".
        const commit = (fn) =>
            ledger.update((state) => {
                if (update.update_id <= state.lastUpdateId) return { duplicate: true };
                const reply = fn ? fn(state) : null;
                state.lastUpdateId = update.update_id;
                return { reply };
            });

        let outcome;
        try {
            outcome = await commit(apply);
        } catch (err) {
            // A change that cannot be applied must not be retried forever.
            log.error(`[telegram] update ${update.update_id} failed while saving: ${redact(err.message)}`);
            outcome = await commit(() => 'Sorry — I could not save that. Please try again.');
        }

        const chatId = update.message?.chat?.id;
        if (outcome.duplicate || !outcome.reply || chatId === undefined) return;
        await send(chatId, outcome.reply).catch((err) => log.error(`[telegram] could not send a reply: ${err.message}`));
    }

    async function run() {
        let me = null;
        for (let wait = 2000; !me && !stopper.signal.aborted; wait = Math.min(wait * 2, 60000)) {
            try {
                me = await call('getMe');
            } catch (err) {
                if (err.status === 401) return log.error('[telegram] TELEGRAM_BOT_TOKEN was rejected by Telegram. Check it, then restart the backend.');
                log.error(`[telegram] could not reach Telegram (${err.message}); retrying in ${wait / 1000}s`);
                await sleep(wait);
            }
        }
        if (!me) return;

        log.log(ownerChatId ? `[telegram] expense bot @${me.username} is listening` : `[telegram] expense bot @${me.username} is in SETUP MODE — message it once to get your chat id`);

        let wait = 1000;
        while (!stopper.signal.aborted) {
            try {
                const offset = (await ledger.read((s) => s.lastUpdateId)) + 1;
                const updates = await call('getUpdates', { offset, timeout: POLL_SECONDS, allowed_updates: ['message'] }, (POLL_SECONDS + 15) * 1000);
                wait = 1000;
                for (const update of updates) await handleUpdate(update);
            } catch (err) {
                if (stopper.signal.aborted) break;
                if (err.status === 401) return log.error('[telegram] TELEGRAM_BOT_TOKEN was rejected by Telegram. Check it, then restart the backend.');
                if (err.status === 409) log.error("[telegram] another program is already reading this bot's messages (or a webhook is set). Only one can at a time.");
                else log.error(`[telegram] polling failed: ${redact(err.message)}; retrying in ${wait / 1000}s`);
                await sleep(wait);
                wait = Math.min(wait * 2, 60000);
            }
        }
    }

    run().catch((err) => log.error(`[telegram] bot stopped unexpectedly: ${redact(err.message)}`));
    return { stop: () => stopper.abort() };
}
