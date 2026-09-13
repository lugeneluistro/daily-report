// Calendar fetching for the calendar card. No LLM here — events are already
// short, structured data (a title and a time), so there's no signal-to-noise
// problem the way an inbox has. Just list what's coming up, chronologically,
// and flag what falls inside tonight's shift window.

import { getAccessToken, configuredAccounts } from './googleAuth.mjs';
import { manilaNow } from './sources.mjs';

const EVENTS_URL = 'https://www.googleapis.com/calendar/v3/calendars/primary/events';
const LOOKAHEAD_HOURS = 36;
const EVENT_LIMIT = 10;

function manilaDateParts(date) {
    const fmt = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit' });
    const parts = Object.fromEntries(fmt.formatToParts(date).map((p) => [p.type, p.value]));
    return { year: Number(parts.year), month: Number(parts.month), day: Number(parts.day) };
}

const dayDiff = (fromParts, toParts) =>
    Math.round((Date.UTC(toParts.year, toParts.month - 1, toParts.day) - Date.UTC(fromParts.year, fromParts.month - 1, fromParts.day)) / 86_400_000);

function startLabel(event, todayParts) {
    if (!event.start?.dateTime) return 'All day';
    const d = new Date(event.start.dateTime);
    const time = d.toLocaleTimeString('en-US', { timeZone: 'Asia/Manila', hour: 'numeric', minute: '2-digit' });
    const diff = dayDiff(todayParts, manilaDateParts(d));
    if (diff <= 0) return time;
    if (diff === 1) return `Tomorrow ${time}`;
    return `+${diff}d ${time}`;
}

/** Manila 8PM tonight through 7AM tomorrow, as UTC instants. Manila has no
 * DST, so 8PM local is always 12:00 UTC on the same calendar date. */
function shiftWindowUtc() {
    const now = manilaNow();
    const todayEightPmUtc = Date.UTC(now.year, now.month - 1, now.day, 12, 0, 0);
    const startMs = now.hour < 12 ? todayEightPmUtc - 24 * 3600 * 1000 : todayEightPmUtc;
    return { startMs, endMs: startMs + 11 * 3600 * 1000 };
}

async function fetchAccountEvents(label, clientId, clientSecret, refreshToken, todayParts, shift) {
    const accessToken = await getAccessToken(clientId, clientSecret, refreshToken);
    const timeMin = new Date().toISOString();
    const timeMax = new Date(Date.now() + LOOKAHEAD_HOURS * 3600 * 1000).toISOString();

    const url = `${EVENTS_URL}?${new URLSearchParams({ timeMin, timeMax, singleEvents: 'true', orderBy: 'startTime', maxResults: String(EVENT_LIMIT) })}`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
    if (!res.ok) throw new Error(`Calendar API returned ${res.status}`);
    const json = await res.json();

    const events = (json.items ?? []).map((ev) => {
        const startMs = ev.start?.dateTime ? new Date(ev.start.dateTime).getTime() : null;
        return {
            id: ev.id,
            title: ev.summary ?? '(no title)',
            startLabel: startLabel(ev, todayParts),
            location: ev.location ?? null,
            duringShift: startMs !== null && startMs >= shift.startMs && startMs < shift.endMs,
        };
    });

    return { label, events };
}

/** Same accounts/tokens as Gmail — the refresh token just needs the
 * calendar.readonly scope alongside gmail.readonly (see
 * google-auth-setup.mjs). An account with no refresh token set is skipped,
 * not failed. */
export async function fetchCalendar() {
    const config = configuredAccounts();
    if (!config) return { ok: false, reason: 'no Google accounts configured' };

    const todayParts = manilaDateParts(new Date());
    const shift = shiftWindowUtc();

    const settled = await Promise.allSettled(
        config.accounts.map((a) => fetchAccountEvents(a.label, config.clientId, config.clientSecret, a.refreshToken, todayParts, shift)),
    );

    const data = [];
    const failed = [];
    settled.forEach((r, i) => {
        if (r.status === 'fulfilled') data.push(r.value);
        else failed.push(`${config.accounts[i].label} (${r.reason.message})`);
    });

    if (data.length === 0) {
        return { ok: false, reason: `all configured accounts failed: ${failed.join('; ')}` };
    }
    return { ok: true, data, partialFailure: failed.length ? failed : null };
}
