/**
 * Types and sample data for the night-brief dashboard.
 *
 * The dashboard reads the brief (shape: BriefPayload) from the local backend,
 * which writes `public/data/brief.json` on every run. `sampleBrief` below is
 * the fallback shown when neither is reachable or the file is still the
 * committed seed — see `useBrief`.
 */

export type Verdict = 'office' | 'watch' | 'wfh';

export interface WeatherHour {
    label: string;
    /** Rain chance for tonight, 0-100. */
    tonight: number;
}

export interface NewsItem {
    id: string;
    title: string;
    /** Rendered in the accent colour inside the title. */
    highlight?: string | null;
    summary: string;
    source: string;
    href: string;
    tone: 'success' | 'warning' | 'info' | 'primary' | 'secondary';
    alert?: boolean;
}

export interface Coin {
    ticker: string;
    name: string;
    price: string;
    change: string;
    /** Up 500%+ in 24h — highlighted. Every tracked coin is shown either way. */
    clearsGate: boolean;
    series: number[];
}

export interface FuelSide {
    label: string;
    /** Pump price per litre; null when the news only reported the weekly change. */
    price: string | null;
    delta: string;
    rising: boolean;
}

export interface FuelInfo {
    gasoline: FuelSide | null;
    /** When it's best to fuel, e.g. "Fill up before Tuesday 6AM". */
    call: string | null;
}

export type RainWarningLevel = 'none' | 'yellow' | 'orange' | 'red' | 'unknown';

export interface CycloneInfo {
    /** 'none' = PAGASA lists no active cyclone; 'unknown' = the bulletin couldn't be read. */
    status: 'none' | 'active' | 'unknown';
    /** PAGASA's local name, e.g. "Ada". Null when inactive, or not yet named locally. */
    localName: string | null;
    /** The international name, e.g. "Kalmaegi". Null when inactive or not stated. */
    internationalName: string | null;
    /** PAGASA's classification as written, e.g. "Tropical Storm", "Typhoon". */
    category: string | null;
    /** Wind signal (1-5) raised over NCR; null when none is. */
    ncrSignal: number | null;
}

export interface RainfallInfo {
    /** Colour of the PAGASA rainfall warning active over NCR. */
    level: RainWarningLevel;
    /** e.g. "2AM" — when that warning runs until, if stated. */
    until: string | null;
    /** No official warning, but an hour tonight is forecast at 15mm/h or more. */
    heavyRainLikely: boolean;
}

export interface VerdictInfo {
    /** Drives the work-from-home card's colour: office = green, watch = amber, wfh = red. */
    call: Verdict;
    /** A government work suspension covering NCR for tonight. */
    ncrSuspension: 'yes' | 'no' | 'unknown';
    cyclone: CycloneInfo;
    rainfall: RainfallInfo;
    /** Jacket / sweatshirt advice from the night's low. Null if weather failed. */
    jacket: 'Recommended' | 'Not recommended' | null;
    lowTempC: number | null;
}

export interface BudgetCategory {
    name: string;
    spent: number;
    /** Null for a category with no monthly limit, such as "Other". */
    limit: number | null;
}

/** Mock only — not wired to a real source yet. See mockBudget below. */
/** One logged expense, as the Budget card lists it. */
export interface BudgetExpense {
    id: string;
    /** YYYY-MM-DD */
    date: string;
    merchant: string;
    category: string;
    amount: number;
}

/** The Budget card's data. The sample below fills the same shape; the real one comes from the local backend's /api/budget. */
export interface BudgetInfo {
    monthLabel: string;
    totalSpent: number;
    totalLimit: number;
    daysLeftInMonth: number;
    categories: BudgetCategory[];
    note: string;
    /** The newest few entries, newest first. Absent in the sample. */
    recent?: BudgetExpense[];
    entriesThisMonth?: number;
    /** When the backend computed this (ISO). Absent in the sample. */
    asOf?: string;
}

export interface BillingLineItem {
    name: string;
    amount: number;
}

export interface BillingProvider {
    provider: 'OpenAI' | 'AWS';
    monthToDateUsd: number;
    currency: string;
    /** Top spend line items (OpenAI: line_item; AWS: service), highest first. */
    topItems: BillingLineItem[];
}

export interface ClaimekBillingInfo {
    monthLabel: string;
    /** One entry per configured provider — OpenAI, AWS, or both. */
    providers: BillingProvider[];
}

/** The contract written by scripts/brief/run.mjs to public/data/brief.json. */
export interface BriefPayload {
    /** True only for the committed seed file — never written by a real run. */
    isSample: boolean;
    /** ISO timestamp of the run that produced this file, or null for the seed. */
    generatedAt: string | null;
    brief: { dateLabel: string; windowLabel: string; place: string };
    verdict: VerdictInfo;
    weatherHours: WeatherHour[];
    /** Null when the week's gasoline adjustment could not be found in the news feeds. */
    fuel: FuelInfo | null;
    /** All three tracked coins; empty only if the price fetch failed. */
    coins: Coin[];
    aiNews: NewsItem[];
    phNews: NewsItem[];
    /** Null when neither OpenAI nor AWS billing is configured — the card is then absent. */
    claimekBilling: ClaimekBillingInfo | null;
    gapsNote: string | null;
}

export const sampleBrief: BriefPayload = {
    isSample: true,
    generatedAt: null,
    brief: {
        dateLabel: 'Wed 9 Sep',
        windowLabel: '8PM-7AM',
        place: 'Makati',
    },
    verdict: {
        call: 'watch',
        ncrSuspension: 'no',
        cyclone: { status: 'none', localName: null, internationalName: null, category: null, ncrSignal: null },
        rainfall: { level: 'orange', until: '2AM', heavyRainLikely: false },
        jacket: 'Not recommended',
        lowTempC: 25,
    },
    weatherHours: [
        { label: '8PM', tonight: 12 },
        { label: '9PM', tonight: 18 },
        { label: '10PM', tonight: 26 },
        { label: '11PM', tonight: 41 },
        { label: '12AM', tonight: 55 },
        { label: '1AM', tonight: 66 },
        { label: '2AM', tonight: 74 },
        { label: '3AM', tonight: 78 },
        { label: '4AM', tonight: 71 },
        { label: '5AM', tonight: 58 },
        { label: '6AM', tonight: 44 },
        { label: '7AM', tonight: 33 },
    ],
    fuel: {
        gasoline: { label: 'Gasoline', price: '₱71.95', delta: '+₱0.90 this week', rising: true },
        call: 'Fill up before Tuesday 6AM',
    },
    coins: [
        {
            ticker: 'XRP',
            name: 'Ripple',
            price: '$4.13',
            change: '+612%',
            clearsGate: true,
            series: [12, 12, 11, 12, 13, 12, 14, 16, 20, 28, 42, 60, 78, 92, 100],
        },
        {
            ticker: 'LTC',
            name: 'Litecoin',
            price: '$92.40',
            change: '-3.2%',
            clearsGate: false,
            series: [60, 58, 62, 55, 50, 54, 48, 52, 45, 49, 44, 47, 43, 45, 42],
        },
        {
            ticker: 'LINK',
            name: 'Chainlink',
            price: '$18.06',
            change: '+1.8%',
            clearsGate: false,
            series: [50, 52, 48, 55, 51, 57, 53, 58, 54, 60, 56, 61, 58, 62, 59],
        },
    ],
    aiNews: [
        {
            id: 'ai-1',
            title: 'Claude Code ships workspace-scoped model settings',
            summary: 'A repo can pin its own model and effort level, so a project keeps plan-mode Opus without touching your global config.',
            source: 'anthropic.com',
            href: 'https://www.anthropic.com/news',
            tone: 'primary',
        },
        {
            id: 'ai-2',
            title: 'Prompt caching extends to one-hour windows',
            summary: 'Long agent sessions stop paying the cold-start penalty between turns. Matters if your team leaves sessions open across a shift.',
            source: 'docs.anthropic.com',
            href: 'https://docs.anthropic.com',
            tone: 'secondary',
        },
        {
            id: 'ai-3',
            title: 'Free-threaded Python reaches production support',
            summary: 'The GIL-free interpreter leaves experimental status, which changes the maths for CPU-bound worker pools.',
            source: 'python.org',
            href: 'https://www.python.org',
            tone: 'info',
        },
        {
            id: 'ai-4',
            title: 'Open-weight coding model closes the gap on Python tasks',
            summary: 'A freely downloadable model now lands within a few points of the paid leaders on real-repo fixes, which matters for on-prem or cost-capped teams.',
            source: 'example.com',
            href: 'https://example.com',
            tone: 'secondary',
        },
        {
            id: 'ai-5',
            title: 'Major API provider halves batch pricing',
            summary: 'Overnight jobs such as test generation and log triage get cheaper, a good fit for night-shift pipelines.',
            source: 'example.com',
            href: 'https://example.com',
            tone: 'primary',
        },
    ],
    phNews: [
        {
            id: 'ph-1',
            title: 'Subway holes through its ',
            highlight: 'third tunnel drive',
            summary: 'Valenzuela to Quirino is connected, keeping a partial 2029 opening on the table.',
            source: 'dotr.gov.ph',
            href: 'https://dotr.gov.ph',
            tone: 'success',
        },
        {
            id: 'ph-2',
            title: 'Two-day jeepney strike from ',
            highlight: 'Monday',
            summary: 'EDSA and Buendia routes. Free rides promised, but budget an extra hour each way for the team.',
            source: 'pna.gov.ph',
            href: 'https://www.pna.gov.ph',
            tone: 'warning',
            alert: true,
        },
        {
            id: 'ph-3',
            title: 'Peso firms to ',
            highlight: '55.80',
            summary: 'A four-month high on stronger remittance inflows, which quietly helps peso savings.',
            source: 'bsp.gov.ph',
            href: 'https://www.bsp.gov.ph',
            tone: 'info',
        },
        {
            id: 'ph-4',
            title: 'IT-BPM hiring outlook ',
            highlight: 'improves for Q4',
            summary: 'Industry groups expect steady tech and support hiring, which is good for the local talent pool.',
            source: 'example.com',
            href: 'https://example.com',
            tone: 'success',
        },
        {
            id: 'ph-5',
            title: 'MRT-3 adds late-night trips on ',
            highlight: 'weekdays',
            summary: 'Extra runs after 11PM should ease the shift-change commute.',
            source: 'example.com',
            href: 'https://example.com',
            tone: 'info',
        },
    ],
    claimekBilling: {
        monthLabel: 'Sep 2026',
        providers: [
            {
                provider: 'OpenAI',
                monthToDateUsd: 184.32,
                currency: 'usd',
                topItems: [
                    { name: 'Text generation', amount: 151.2 },
                    { name: 'Embeddings', amount: 22.4 },
                    { name: 'Fine-tuning', amount: 10.72 },
                ],
            },
            {
                provider: 'AWS',
                monthToDateUsd: 96.87,
                currency: 'usd',
                topItems: [
                    { name: 'EC2 - Other', amount: 41.05 },
                    { name: 'Amazon RDS Service', amount: 28.3 },
                    { name: 'Amazon S3', amount: 14.52 },
                    { name: 'CloudWatch', amount: 13.0 },
                ],
            },
        ],
    },
    gapsNote: null,
};

/**
 * Mock only — no budget source is wired up yet. Shown as-is regardless of
 * isLive, with its own "Mock data" meta line so it never reads as real.
 */
export const mockBudget: BudgetInfo = {
    monthLabel: 'September',
    totalSpent: 28450,
    totalLimit: 35000,
    daysLeftInMonth: 16,
    categories: [
        { name: 'Groceries', spent: 6200, limit: 8000 },
        { name: 'Transport', spent: 3100, limit: 3500 },
        { name: 'Dining', spent: 4800, limit: 4000 },
        { name: 'Utilities', spent: 5350, limit: 6000 },
        { name: 'Savings goal', spent: 9000, limit: 9000 },
    ],
    note: 'On track if spending holds — Dining is already over for the month.',
};
