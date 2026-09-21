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

        const url =
            `https://api.open-meteo.com/v1/forecast?latitude=${MAKATI.latitude}&longitude=${MAKATI.longitude}` +
            `&hourly=temperature_2m,precipitation_probability,precipitation&timezone=Asia/Manila&past_days=1&forecast_days=2`;

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
            const i = indexOf(day, hour);
            return {
                label: labelForHour(hour),
                tonight: i >= 0 ? Math.round(rainChance[i]) : 0,
                temp: i >= 0 ? Math.round(temps[i]) : null,
                mm: i >= 0 ? rainMm[i] : 0,
            };
        });

        if (weatherHours.some((h) => h.temp === null)) {
            return { ok: false, reason: 'Open-Meteo response missing hours for tonight\'s window' };
        }

        const minTemp = Math.min(...weatherHours.map((h) => h.temp));
        const peak = weatherHours.reduce((best, h) => (h.tonight > best.tonight ? h : best), weatherHours[0]);
        const maxPrecipMm = Math.max(...weatherHours.map((h) => h.mm));

        return {
            ok: true,
            data: {
                // The chart only renders the hourly rain chance; temp and mm/h are
                // used above (jacket advice, WFH threshold) and stay internal.
                weatherHours: weatherHours.map(({ label, tonight }) => ({ label, tonight })),
                minTemp,
                peakRain: { percent: peak.tonight, hourLabel: peak.label },
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

/** XRP, LTC, LINK — 24h change plus a downsampled sparkline. All three are
 * always returned; `clearsGate` just marks a 500%+ spike for highlighting. */
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

        // CoinGecko returns market-cap order; keep the card in a stable XRP, LTC, LINK order.
        json.sort((a, b) => ids.indexOf(a.id) - ids.indexOf(b.id));

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

// `limit` caps how many of a feed's newest items reach the model (default 12), which
// keeps the prompt small now that there are more feeds. Grouped by the card they feed.
const FEEDS = [
    // Philippines + fuel + suspensions
    { source: 'GMA News (Nation)', url: 'https://data.gmanetwork.com/gno/rss/news/nation/feed.xml' },
    { source: 'GMA News (Metro)', url: 'https://data.gmanetwork.com/gno/rss/news/metro/feed.xml' },
    { source: 'GMA News (Economy)', url: 'https://data.gmanetwork.com/gno/rss/money/economy/feed.xml' },
    { source: 'Philippine Daily Inquirer', url: 'https://newsinfo.inquirer.net/feed', limit: 10 },
    { source: 'Philstar', url: 'https://www.philstar.com/rss/headlines', limit: 8 },
    { source: 'BusinessWorld', url: 'https://www.bworldonline.com/feed/', limit: 8 },
    // AI: Claude first, then the other labs and tooling. Only one hnrss.org request per run:
    // it answers 429 to more than a few, and a dead feed just drops out of the list.
    { source: 'Hacker News (Claude/Anthropic)', url: 'https://hnrss.org/newest?q=Claude+OR+Anthropic&count=15' },
    { source: 'Claude Code releases (GitHub)', url: 'https://github.com/anthropics/claude-code/releases.atom', limit: 4 },
    { source: 'Simon Willison', url: 'https://simonwillison.net/atom/everything/' },
    { source: 'The Verge (AI)', url: 'https://www.theverge.com/rss/ai-artificial-intelligence/index.xml', limit: 6 },
    { source: 'OpenAI news', url: 'https://openai.com/news/rss.xml', limit: 6 },
    { source: 'Google DeepMind blog', url: 'https://deepmind.google/blog/rss.xml', limit: 6 },
    { source: 'Ars Technica (AI)', url: 'https://arstechnica.com/ai/feed/', limit: 6 },
];

/** RSS/Atom only — cheap, keyless, and gives the LLM candidate headlines
 * instead of it having to fetch pages itself. One dead feed does not fail
 * the others. */
export async function fetchFeeds() {
    const settled = await Promise.allSettled(
        FEEDS.map(async (f) => {
            const feed = await rssParser.parseURL(f.url);
            // Newest first, whatever order the feed came in — some (OpenAI's) list thousands of items.
            const dated = (item) => new Date(item.isoDate ?? item.pubDate ?? 0).getTime() || 0;
            return [...(feed.items ?? [])].sort((a, b) => dated(b) - dated(a)).slice(0, f.limit ?? 12).map((item) => ({
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

const SUSPENSION_QUERIES = [
    'work suspension government offices Metro Manila when:7d',
    'suspension of work in government offices when:3d',
    'Malacañang suspends work classes NCR when:3d',
];
const SUSPENSION_MAX_AGE_DAYS = 8;
const SUSPENSION_MAX_ITEMS = 15;

// Google's matching is fuzzy and pads a quiet week with unrelated stories from
// anywhere. A loose keyword screen — Philippine-government wording, or a
// suspension word next to a work word — keeps that noise from crowding real
// headlines out of the capped list. The model still makes the actual call.
const SUSPENSION_SCOPE = /\b(malaca[nñ]ang|palace|ncr|metro manila|makati|marcos|gov['’]?t offices?|government offices?|state workers|civil service|walang pasok)\b/i;
const SUSPENSION_WORD = /suspen|shorten|half[- ]?day|no work|cancel|walang pasok|work[- ]from[- ]home|\bwfh\b/i;
const SUSPENSION_WORK_WORD = /\b(work|offices?|classes|gov['’]?t|government)\b/i;
const looksLikeSuspension = (title) => SUSPENSION_SCOPE.test(title) || (SUSPENSION_WORD.test(title) && SUSPENSION_WORK_WORD.test(title));

/** Google News search as RSS (keyless), aimed at one question: is government work
 * suspended in NCR? The general feeds above only carry the newest dozen headlines,
 * so a suspension can be missing from them; this searches for it. Titles arrive
 * as "Headline - Outlet". An empty list with ok:true means the search ran and
 * found nothing — different from ok:false, where it could not run. */
export async function fetchSuspensionNews() {
    const settled = await Promise.allSettled(
        SUSPENSION_QUERIES.map(async (query) => {
            const url = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=en-PH&gl=PH&ceid=PH:en`;
            const feed = await rssParser.parseURL(url);
            return feed.items ?? [];
        }),
    );

    if (settled.every((r) => r.status === 'rejected')) {
        return { ok: false, reason: 'Google News search unreachable' };
    }

    const oldest = Date.now() - SUSPENSION_MAX_AGE_DAYS * 24 * 60 * 60 * 1000;
    const seen = new Set();
    const items = [];
    for (const result of settled) {
        if (result.status !== 'fulfilled') continue;
        for (const item of result.value) {
            const raw = (item.title ?? '').trim();
            const cut = raw.lastIndexOf(' - ');
            const title = cut > 0 ? raw.slice(0, cut) : raw;
            const published = item.isoDate ?? item.pubDate ?? null;
            const key = title.toLowerCase();
            if (!title || seen.has(key) || !looksLikeSuspension(title)) continue;
            if (published && new Date(published).getTime() < oldest) continue;
            seen.add(key);
            items.push({ source: cut > 0 ? raw.slice(cut + 3) : 'Google News', title, published });
        }
    }

    items.sort((a, b) => new Date(b.published ?? 0).getTime() - new Date(a.published ?? 0).getTime());
    const failed = settled.filter((r) => r.status === 'rejected').length;
    return { ok: true, data: items.slice(0, SUSPENSION_MAX_ITEMS), partialFailure: failed ? [`${failed} of ${SUSPENSION_QUERIES.length} suspension searches`] : null };
}
