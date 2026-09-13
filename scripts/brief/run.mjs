// Orchestrator: runs every fetcher, makes the one LLM call, merges
// deterministic + judged output, and writes public/data/brief.json.
//
// Usage: ANTHROPIC_API_KEY=... node scripts/brief/run.mjs

import { writeFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { manilaNow, fetchWeather, fetchCoins, fetchPagasa, fetchFeeds } from './sources.mjs';
import { fetchGmail } from './gmail.mjs';
import { fetchCalendar } from './calendar.mjs';
import { judgeBrief } from './llm.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_PATH = join(__dirname, '..', '..', 'public', 'data', 'brief.json');

const WEEKDAY_INDEX = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

/** SKILL.md §2: the call binds Mon-Wed, and Thu before 8PM. Every other run
 * is advisory only. */
function liveStatus(clock) {
    const day = WEEKDAY_INDEX[clock.weekday];
    if (day >= 1 && day <= 3) return { live: true };
    if (day === 4) return clock.hour < 20 ? { live: true } : { live: false, note: 'the shift has already started and the next office night isn\'t until Monday' };
    if (day === 5) return { live: false, note: 'Friday is already a work-from-home day' };
    return { live: false, note: 'no team to send home tonight, and Gino is in Calamba' };
}

const WEEKDAY_LABEL = { Sun: 'Sun', Mon: 'Mon', Tue: 'Tue', Wed: 'Wed', Thu: 'Thu', Fri: 'Fri', Sat: 'Sat' };

async function main() {
    const clock = manilaNow();
    const { live, note: advisoryNote } = liveStatus(clock);

    const [weatherResult, coinsResult, pagasaResult, feedsResult, gmailResult, calendarResult] = await Promise.all([
        fetchWeather(),
        fetchCoins(),
        fetchPagasa(),
        fetchFeeds(),
        fetchGmail(),
        fetchCalendar(),
    ]);

    const deterministicGaps = [];
    if (!weatherResult.ok) deterministicGaps.push(`weather sources failed (${weatherResult.reason})`);
    if (!coinsResult.ok) deterministicGaps.push(`crypto prices unavailable (${coinsResult.reason})`);

    const pagasaFailedPages = pagasaResult.ok ? pagasaResult.partialFailure ?? [] : ['severe-weather-bulletin', 'weather-advisory'];
    const feedsFailedSources = feedsResult.ok ? feedsResult.partialFailure ?? [] : ['all feeds'];
    if (!feedsResult.ok) deterministicGaps.push(`news sources failed (${feedsResult.reason})`);

    // "Not configured" is not a gap — it's an expected absence until secrets are set.
    // A configured account that fails to fetch is a real gap.
    if (gmailResult.ok && gmailResult.partialFailure) {
        deterministicGaps.push(`email account(s) unreachable: ${gmailResult.partialFailure.join('; ')}`);
    }
    if (calendarResult.ok && calendarResult.partialFailure) {
        deterministicGaps.push(`calendar account(s) unreachable: ${calendarResult.partialFailure.join('; ')}`);
    }

    const emailAccounts = gmailResult.ok ? gmailResult.data.map((a) => ({ label: a.label, unreadCount: a.unreadCount, candidates: a.candidates })) : [];

    const judged = await judgeBrief({
        manilaClock: clock,
        weather: weatherResult.ok ? weatherResult.data : null,
        pagasa: pagasaResult.ok ? pagasaResult.data : null,
        feeds: feedsResult.ok ? feedsResult.data : [],
        pagasaFailedPages,
        feedsFailedSources,
        emailAccounts,
    });

    // Crypto: drop every coin under the 500% gate. An empty array means the
    // card is absent, matching the skill's "drop the card rather than
    // rendering an empty one" rule.
    const coins = coinsResult.ok ? coinsResult.data.filter((c) => c.clearsGate) : [];

    const weather = weatherResult.ok ? weatherResult.data : null;
    const wearLine = weather ? buildWearLine(weather) : null;

    const reason = live ? judged.wfh.reason : `${judged.wfh.reason} Advisory only — ${advisoryNote}.`;

    const verdict = {
        call: judged.wfh.call,
        title: judged.wfh.title,
        signal: judged.wfh.signal,
        binding: live ? `${WEEKDAY_LABEL[clock.weekday]} · the call binds tonight` : `${WEEKDAY_LABEL[clock.weekday]} · advisory only`,
        reason,
        chips: [weather ? `Rain peaks ${weather.peakRain.percent}% at ${weather.peakRain.hourLabel}` : null, wearLine].filter(Boolean),
        deadline: live ? 'Decide by 6PM' : 'Advisory only',
    };

    const fuel = judged.fuel.found
        ? {
              diesel: judged.fuel.diesel
                  ? { label: 'Diesel', price: judged.fuel.diesel, delta: judged.fuel.dieselDelta ?? '', rising: judged.fuel.dieselRising ?? false }
                  : null,
              gasoline: judged.fuel.gasoline
                  ? { label: 'Gasoline', price: judged.fuel.gasoline, delta: judged.fuel.gasolineDelta ?? '', rising: judged.fuel.gasolineRising ?? false }
                  : null,
              call: judged.fuel.call,
              note: judged.fuel.note,
          }
        : null;

    const gaps = [...deterministicGaps, ...judged.gaps];

    const brief = {
        isSample: false,
        generatedAt: new Date().toISOString(),
        brief: {
            dateLabel: `${WEEKDAY_LABEL[clock.weekday]} ${clock.day} ${MONTH_LABEL[clock.month]}`,
            windowLabel: '8PM-7AM',
            place: 'Makati',
        },
        verdict,
        weatherHours: weather ? weather.weatherHours : [],
        fuel,
        coins,
        aiNews: judged.aiNews.map((n, i) => ({ id: `ai-${i + 1}`, ...n })),
        phNews: judged.phNews.map((n, i) => ({ id: `ph-${i + 1}`, ...n })),
        // Absent (not just empty) when no Gmail/Google account is configured, so the card hides.
        email: gmailResult.ok
            ? judged.email.map((acct) => ({ ...acct, items: acct.items.map((item, i) => ({ id: item.id || `email-${i}`, ...item })) }))
            : null,
        calendar: calendarResult.ok ? calendarResult.data : null,
        gapsNote: gaps.length ? gaps.join('; ') : null,
    };

    await mkdir(dirname(OUTPUT_PATH), { recursive: true });
    await writeFile(OUTPUT_PATH, JSON.stringify(brief, null, 2) + '\n', 'utf-8');
    console.log(`Wrote ${OUTPUT_PATH}`);
}

const MONTH_LABEL = { 1: 'Jan', 2: 'Feb', 3: 'Mar', 4: 'Apr', 5: 'May', 6: 'Jun', 7: 'Jul', 8: 'Aug', 9: 'Sep', 10: 'Oct', 11: 'Nov', 12: 'Dec' };

function buildWearLine(weather) {
    const { minTemp, mentionRainGear } = weather;
    let wear;
    if (minTemp >= 26) wear = 'light, it stays warm';
    else if (minTemp >= 24) wear = 'normal';
    else wear = 'take a jacket';
    return `Low ${minTemp}°C · ${wear}${mentionRainGear ? ' · bring rain gear' : ''}`;
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
