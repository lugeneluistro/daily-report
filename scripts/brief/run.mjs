// Orchestrator: runs every fetcher, makes the one LLM call, merges
// deterministic + judged output. generateBrief() returns the payload with no
// file I/O — used by both this CLI entry point and server/index.mjs.
//
// CLI usage: ANTHROPIC_API_KEY=... node scripts/brief/run.mjs

import { writeFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { manilaNow, fetchWeather, fetchCoins, fetchPagasa, fetchFeeds, fetchSuspensionNews } from './sources.mjs';
import { fetchGmail } from './gmail.mjs';
import { fetchCalendar } from './calendar.mjs';
import { fetchClaimekBilling, checkBillingAlert } from './billing.mjs';
import { judgeBrief } from './llm.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
export const OUTPUT_PATH = join(__dirname, '..', '..', 'public', 'data', 'brief.json');

const WEEKDAY_INDEX = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
const WEEKDAY_LABEL = { Sun: 'Sun', Mon: 'Mon', Tue: 'Tue', Wed: 'Wed', Thu: 'Thu', Fri: 'Fri', Sat: 'Sat' };
const MONTH_LABEL = { 1: 'Jan', 2: 'Feb', 3: 'Mar', 4: 'Apr', 5: 'May', 6: 'Jun', 7: 'Jul', 8: 'Aug', 9: 'Sep', 10: 'Oct', 11: 'Nov', 12: 'Dec' };

/** SKILL.md §2: the call binds Mon-Wed, and Thu before 8PM. Every other run
 * (Thu night, Fri, weekends) is advisory only. */
function callBinds(clock) {
    const day = WEEKDAY_INDEX[clock.weekday];
    if (day >= 1 && day <= 3) return true;
    return day === 4 && clock.hour < 20;
}

/** Rule from the report-today skill (§1): a low of 23C or below makes a jacket
 * or sweatshirt worth it. */
const JACKET_BELOW_C = 24;

/** Runs every fetcher, makes the LLM call, and returns the brief payload.
 * Pure — never touches the filesystem. */
export async function generateBrief() {
    const clock = manilaNow();
    const live = callBinds(clock);

    const [weatherResult, coinsResult, pagasaResult, feedsResult, suspensionResult, gmailResult, calendarResult, billingResult] = await Promise.all([
        fetchWeather(),
        fetchCoins(),
        fetchPagasa(),
        fetchFeeds(),
        fetchSuspensionNews(),
        fetchGmail(),
        fetchCalendar(),
        fetchClaimekBilling(),
    ]);

    const deterministicGaps = [];
    if (!weatherResult.ok) deterministicGaps.push(`weather sources failed (${weatherResult.reason})`);
    if (!coinsResult.ok) deterministicGaps.push(`crypto prices unavailable (${coinsResult.reason})`);

    const pagasaFailedPages = pagasaResult.ok ? pagasaResult.partialFailure ?? [] : ['severe-weather-bulletin', 'weather-advisory'];
    const feedsFailedSources = feedsResult.ok ? feedsResult.partialFailure ?? [] : ['all feeds'];
    if (!feedsResult.ok) deterministicGaps.push(`news sources failed (${feedsResult.reason})`);
    // A failed search must read as "could not check", never as "no suspension".
    if (!suspensionResult.ok) deterministicGaps.push(`government work-suspension search failed (${suspensionResult.reason})`);

    // "Not configured" is not a gap — it's an expected absence until secrets are set.
    // A configured account that fails to fetch is a real gap.
    if (gmailResult.ok && gmailResult.partialFailure) {
        deterministicGaps.push(`email account(s) unreachable: ${gmailResult.partialFailure.join('; ')}`);
    }
    if (calendarResult.ok && calendarResult.partialFailure) {
        deterministicGaps.push(`calendar account(s) unreachable: ${calendarResult.partialFailure.join('; ')}`);
    }
    if (billingResult.ok && billingResult.partialFailure) {
        deterministicGaps.push(`billing provider(s) unreachable: ${billingResult.partialFailure.join('; ')}`);
    }

    const emailAccounts = gmailResult.ok ? gmailResult.data.map((a) => ({ label: a.label, unreadCount: a.unreadCount, candidates: a.candidates })) : [];

    const judged = await judgeBrief({
        manilaClock: clock,
        weather: weatherResult.ok ? weatherResult.data : null,
        pagasa: pagasaResult.ok ? pagasaResult.data : null,
        feeds: feedsResult.ok ? feedsResult.data : [],
        suspension: { searched: suspensionResult.ok, candidates: suspensionResult.ok ? suspensionResult.data : [] },
        pagasaFailedPages,
        feedsFailedSources,
        emailAccounts,
    });

    // Crypto: always show all three tracked coins. `clearsGate` (500%+ in 24h)
    // only decides which one gets highlighted. Empty only if the price fetch failed.
    const coins = coinsResult.ok ? coinsResult.data : [];

    const weather = weatherResult.ok ? weatherResult.data : null;

    // The dashboard shows this as a short checklist, not a paragraph.
    const verdict = {
        call: judged.wfh.call,
        ncrSuspension: judged.wfh.ncrSuspension,
        cyclone: judged.wfh.cyclone,
        rainfall: judged.wfh.rainfall,
        jacket: weather ? (weather.minTemp < JACKET_BELOW_C ? 'Recommended' : 'Not recommended') : null,
        lowTempC: weather ? weather.minTemp : null,
        deadline: live ? 'Decide by 6PM' : 'Advisory only',
    };

    // Gasoline only. The news often reports the weekly change without the pump
    // price, so either one is enough to show the row.
    const fuel = judged.fuel.found
        ? {
              gasoline:
                  judged.fuel.gasoline || judged.fuel.gasolineDelta
                      ? { label: 'Gasoline', price: judged.fuel.gasoline, delta: judged.fuel.gasolineDelta ?? '', rising: judged.fuel.gasolineRising ?? false }
                      : null,
              call: judged.fuel.call,
          }
        : null;

    const gaps = [...deterministicGaps, ...judged.gaps];

    return {
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
        claimekBilling: billingResult.ok ? { monthLabel: `${MONTH_LABEL[clock.month]} ${clock.year}`, providers: billingResult.data } : null,
        gapsNote: gaps.length ? gaps.join('; ') : null,
    };
}

async function main() {
    const brief = await generateBrief();
    await mkdir(dirname(OUTPUT_PATH), { recursive: true });
    await writeFile(OUTPUT_PATH, JSON.stringify(brief, null, 2) + '\n', 'utf-8');
    console.log(`Wrote ${OUTPUT_PATH}`);
    await checkBillingAlert(brief.claimekBilling);
}

// Only run as a CLI when invoked directly — not when imported by the server.
if (process.argv[1] === fileURLToPath(import.meta.url)) {
    main().catch((err) => {
        console.error(err);
        process.exit(1);
    });
}
