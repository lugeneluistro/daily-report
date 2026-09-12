// All fetching for the night brief. No LLM here — every function below is a
// pure data pull. Each resolves to {ok: true, data} or {ok: false, reason} so
// one dead source never kills the run (see run.mjs).

import Parser from 'rss-parser';

const MAKATI = { latitude: 14.5547, longitude: 121.0244 };
const rssParser = new Parser({ timeout: 10_000 });

/** Manila has no DST, but we still read the wall clock through Intl so this
 * is correct regardless of the machine's own timezone (CI runs in UTC). */
export function manilaNow(date = new Date()) {
    const fmt = new Intl.DateTimeFormat('en-US', {
        timeZone: 'Asia/Manila',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
        weekday: 'short',
    });
    const parts = Object.fromEntries(fmt.formatToParts(date).map((p) => [p.type, p.value]));
    return {
        year: Number(parts.year),
        month: Number(parts.month),
        day: Number(parts.day),
        hour: parts.hour === '24' ? 0 : Number(parts.hour),
        minute: Number(parts.minute),
        weekday: parts.weekday, // "Mon", "Tue", ...
    };
}

const pad2 = (n) => String(n).padStart(2, '0');
const dateStr = ({ year, month, day }) => `${year}-${pad2(month)}-${pad2(day)}`;

function addDays({ year, month, day }, delta) {
    const d = new Date(Date.UTC(year, month - 1, day));
    d.setUTCDate(d.getUTCDate() + delta);
    return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() };
}

const HOURS_8PM_TO_7AM = [20, 21, 22, 23, 0, 1, 2, 3, 4, 5, 6, 7];

function labelForHour(h) {
    if (h === 0) return '12AM';
    if (h < 12) return `${h}AM`;
    if (h === 12) return '12PM';
    return `${h - 12}PM`;
}

/** Pulls the 12-hour 8PM-7AM window (tonight) plus the same clock hours one
 * night earlier, per SKILL.md's weather rules. */
export async function fetchWeather() {
    try {
        const now = manilaNow();
        // Before noon means we're still inside last night's window, which
        // started 8PM yesterday. Otherwise tonight's window starts 8PM today.
        const windowStart = now.hour < 12 ? addDays(now, -1) : now;
        const lastNightStart = addDays(windowStart, -1);

        const url =
            `https://api.open-meteo.com/v1/forecast?latitude=${MAKATI.latitude}&longitude=${MAKATI.longitude}` +
            `&hourly=temperature_2m,precipitation_probability,precipitation&timezone=Asia/Manila&past_days=2&forecast_days=2`;

        const res = await fetch(url);
        if (!res.ok) return { ok: false, reason: `Open-Meteo returned ${res.status}` };
        const json = await res.json();

        const times = json.hourly?.time ?? [];
        const temps = json.hourly?.temperature_2m ?? [];
        const rainChance = json.hourly?.precipitation_probability ?? [];
        // mm/h, not the 0-100 display chance above — this is what PAGASA's
        // yellow/orange/red rainfall thresholds are actually measured in.
        const rainMm = json.hourly?.precipitation ?? [];
        const indexOf = (day, hour) => times.indexOf(`${dateStr(day)}T${pad2(hour)}:00`);

        const weatherHours = HOURS_8PM_TO_7AM.map((hour) => {
            const day = hour >= 20 ? windowStart : addDays(windowStart, 1);
            const lastDay = hour >= 20 ? lastNightStart : addDays(lastNightStart, 1);
            const i = indexOf(day, hour);
            const iLast = indexOf(lastDay, hour);
            return {
                label: labelForHour(hour),
                tonight: i >= 0 ? Math.round(rainChance[i]) : 0,
                lastNight: iLast >= 0 ? Math.round(rainChance[iLast]) : 0,
                temp: i >= 0 ? Math.round(temps[i]) : null,
                mm: i >= 0 ? rainMm[i] : 0,
            };
        });

        if (weatherHours.some((h) => h.temp === null)) {
            return { ok: false, reason: 'Open-Meteo response missing hours for tonight\'s window' };
        }

        const minTemp = Math.min(...weatherHours.map((h) => h.temp));
        const peak = weatherHours.reduce((best, h) => (h.tonight > best.tonight ? h : best), weatherHours[0]);
        const hoursAtOrAbove60 = weatherHours.filter((h) => h.tonight >= 60).length;
        const maxPrecipMm = Math.max(...weatherHours.map((h) => h.mm));

        return {
            ok: true,
            data: {
                // Drop the mm/h helper field — the card only ever renders tonight/lastNight/temp.
                weatherHours: weatherHours.map(({ mm, ...h }) => h),
                minTemp,
                peakRain: { percent: peak.tonight, hourLabel: peak.label },
                mentionRainGear: hoursAtOrAbove60 > 0,
                windowStartedYesterday: now.hour < 12,
                // For the WFH rainfall-threshold rule (mm/h, not the chart's % chance).
                maxPrecipMm: Math.round(maxPrecipMm * 10) / 10,
                anyHourAtOrAbove15mm: maxPrecipMm >= 15,
            },
        };
    } catch (err) {
        return { ok: false, reason: `Weather fetch failed: ${err.message}` };
    }
}

/** XRP, LTC, LINK — 24h change plus a downsampled sparkline. Every coin is
 * returned; run.mjs drops the ones under the 500% gate. */
export async function fetchCoins() {
    try {
        const ids = ['ripple', 'litecoin', 'chainlink'];
        const url = `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${ids.join(',')}&price_change_percentage=24h&sparkline=true`;
        const res = await fetch(url);
        if (!res.ok) return { ok: false, reason: `CoinGecko returned ${res.status}` };
        const json = await res.json();

        const NAMES = { ripple: ['XRP', 'Ripple'], litecoin: ['LTC', 'Litecoin'], chainlink: ['LINK', 'Chainlink'] };
        const downsample = (arr, n) => {
            if (arr.length <= n) return arr;
            const step = (arr.length - 1) / (n - 1);
            return Array.from({ length: n }, (_, i) => arr[Math.round(i * step)]);
        };

        const coins = json.map((c) => {
            const [ticker, name] = NAMES[c.id] ?? [c.symbol.toUpperCase(), c.name];
            const changePct = c.price_change_percentage_24h_in_currency ?? c.price_change_percentage_24h ?? 0;
            const sparkline = c.sparkline_in_7d?.price ?? [];
            const last24h = sparkline.slice(-24);
            return {
                ticker,
                name,
                price: `$${c.current_price.toLocaleString('en-US', { maximumFractionDigits: c.current_price < 1 ? 4 : 2 })}`,
                change: `${changePct >= 0 ? '+' : ''}${changePct.toFixed(1)}%`,
                clearsGate: changePct >= 500,
                series: downsample(last24h.length ? last24h : sparkline, 15),
            };
        });

        return { ok: true, data: coins };
    } catch (err) {
        return { ok: false, reason: `Crypto fetch failed: ${err.message}` };
    }
}

const stripHtml = (html) =>
    html
        .replace(/<script[\s\S]*?<\/script>/gi, '')
        .replace(/<style[\s\S]*?<\/style>/gi, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/&nbsp;/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

async function fetchPage(url, maxChars) {
    const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (night-brief-bot)' } });
    if (!res.ok) throw new Error(`${url} returned ${res.status}`);
    const html = await res.text();
    return stripHtml(html).slice(0, maxChars);
}

/** PAGASA has no API; we hand the model truncated plain text of both pages
 * and let it read the same way a human would. */
export async function fetchPagasa() {
    const pages = [
        { name: 'severe-weather-bulletin', url: 'https://www.pagasa.dost.gov.ph/tropical-cyclone/severe-weather-bulletin' },
        { name: 'weather-advisory', url: 'https://www.pagasa.dost.gov.ph/weather/weather-advisory' },
    ];

    const results = await Promise.allSettled(pages.map((p) => fetchPage(p.url, 4000)));
    const data = {};
    const failed = [];
    results.forEach((r, i) => {
        if (r.status === 'fulfilled') data[pages[i].name] = r.value;
        else failed.push(pages[i].name);
    });

    if (Object.keys(data).length === 0) {
        return { ok: false, reason: 'PAGASA pages unreachable' };
    }
    return { ok: true, data, partialFailure: failed.length ? failed : null };
}

const FEEDS = [
    { source: 'GMA News (Nation)', url: 'https://data.gmanetwork.com/gno/rss/news/nation/feed.xml' },
    { source: 'GMA News (Metro)', url: 'https://data.gmanetwork.com/gno/rss/news/metro/feed.xml' },
    { source: 'GMA News (Economy)', url: 'https://data.gmanetwork.com/gno/rss/money/economy/feed.xml' },
    { source: 'Hacker News (Claude/Anthropic)', url: 'https://hnrss.org/newest?q=Claude+OR+Anthropic&count=15' },
    { source: 'Simon Willison', url: 'https://simonwillison.net/atom/everything/' },
];

/** RSS/Atom only — cheap, keyless, and gives the LLM candidate headlines
 * instead of it having to fetch pages itself. One dead feed does not fail
 * the others. */
export async function fetchFeeds() {
    const settled = await Promise.allSettled(
        FEEDS.map(async (f) => {
            const feed = await rssParser.parseURL(f.url);
            return (feed.items ?? []).slice(0, 12).map((item) => ({
                source: f.source,
                title: item.title ?? '',
                href: item.link ?? '',
                published: item.isoDate ?? item.pubDate ?? null,
                summary: (item.contentSnippet ?? item.content ?? '').replace(/\s+/g, ' ').trim().slice(0, 240),
            }));
        }),
    );

    const items = settled.filter((r) => r.status === 'fulfilled').flatMap((r) => r.value);
    const failedFeeds = FEEDS.filter((_, i) => settled[i].status === 'rejected').map((f) => f.source);

    if (items.length === 0) {
        return { ok: false, reason: 'All news feeds unreachable' };
    }
    return { ok: true, data: items, partialFailure: failedFeeds.length ? failedFeeds : null };
}
