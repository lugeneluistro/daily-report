/**
 * Types and sample data for the night-brief dashboard.
 *
 * The dashboard fetches `/data/brief.json` (shape: BriefPayload), written
 * nightly by `scripts/brief/run.mjs` via a GitHub Actions cron. `sampleBrief`
 * below is the fallback shown when that fetch fails or the file is still the
 * committed seed — see `useBrief`.
 */

export type Verdict = 'office' | 'watch' | 'wfh';

export interface WeatherHour {
    label: string;
    /** Rain chance for tonight, 0-100. */
    tonight: number;
    /** Rain chance over the same hour last night, 0-100. */
    lastNight: number;
    /** Temperature in celsius. */
    temp: number;
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
    /** Only coins at or above +500% in 24h render on a live run. */
    clearsGate: boolean;
    series: number[];
}

export interface FuelSide {
    label: string;
    price: string;
    delta: string;
    rising: boolean;
}

export interface FuelInfo {
    diesel: FuelSide | null;
    gasoline: FuelSide | null;
    call: string | null;
    note: string | null;
}

export interface VerdictInfo {
    call: Verdict;
    title: string;
    signal: string;
    binding: string;
    reason: string;
    chips: string[];
    deadline: string;
}

export interface EmailItem {
    id: string;
    from: string;
    subject: string;
    /** Why this was surfaced, written by the nightly filter — not the raw Gmail snippet. */
    summary: string;
    /** Looks time-sensitive or needs a reply this shift. */
    important: boolean;
}

export interface EmailAccountSummary {
    /** A short label ("Personal", "Work"), not the raw email address. */
    label: string;
    unreadCount: number;
    /** Up to 5 unread messages the nightly filter judged worth surfacing. */
    items: EmailItem[];
}

export interface CalendarEvent {
    id: string;
    title: string;
    /** Pre-formatted Manila-local display time, e.g. "8:30 PM", "Tomorrow 9:00 AM", "All day". */
    startLabel: string;
    location: string | null;
    /** Starts inside tonight's 8PM-7AM window. */
    duringShift: boolean;
}

export interface CalendarAccountSummary {
    /** A short label ("Personal", "Work"), not the raw email address. */
    label: string;
    /** Next few events over the following ~36h, chronological. */
    events: CalendarEvent[];
}

export interface BudgetCategory {
    name: string;
    spent: number;
    limit: number;
}

/** Mock only — not wired to a real source yet. See mockBudget below. */
export interface BudgetMock {
    monthLabel: string;
    totalSpent: number;
    totalLimit: number;
    daysLeftInMonth: number;
    categories: BudgetCategory[];
    note: string;
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
    /** Null when the week's adjustment could not be found in the news feeds. */
    fuel: FuelInfo | null;
    /** Empty when no coin clears the +500% gate — the card is then absent. */
    coins: Coin[];
    aiNews: NewsItem[];
    phNews: NewsItem[];
    /** Null when no Gmail account is configured — the card is then absent. */
    email: EmailAccountSummary[] | null;
    /** Null when no Google account is configured — the card is then absent. */
    calendar: CalendarAccountSummary[] | null;
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
        title: 'Watch it',
        signal: 'Orange rainfall warning to 2AM',
        binding: 'Wed · the call binds tonight',
        reason:
            'No NCR work suspension announced and no tropical cyclone inside PAR, so there is no wind signal. The deciding signal is the orange rainfall warning, with Buendia already gutter-deep on the Makati approach.',
        chips: ['Rain peaks 78% at 3AM', 'Low 23°C · take a jacket'],
        deadline: 'Decide by 6PM',
    },
    weatherHours: [
        { label: '8PM', tonight: 12, lastNight: 8, temp: 29 },
        { label: '9PM', tonight: 18, lastNight: 10, temp: 28 },
        { label: '10PM', tonight: 26, lastNight: 14, temp: 28 },
        { label: '11PM', tonight: 41, lastNight: 17, temp: 27 },
        { label: '12AM', tonight: 55, lastNight: 22, temp: 27 },
        { label: '1AM', tonight: 66, lastNight: 26, temp: 26 },
        { label: '2AM', tonight: 74, lastNight: 31, temp: 25 },
        { label: '3AM', tonight: 78, lastNight: 29, temp: 24 },
        { label: '4AM', tonight: 71, lastNight: 24, temp: 23 },
        { label: '5AM', tonight: 58, lastNight: 19, temp: 23 },
        { label: '6AM', tonight: 44, lastNight: 15, temp: 24 },
        { label: '7AM', tonight: 33, lastNight: 11, temp: 25 },
    ],
    fuel: {
        diesel: { label: 'Diesel', price: '₱65.55', delta: '+₱1.35 this week', rising: true },
        gasoline: { label: 'Gasoline', price: '₱71.95', delta: '+₱0.90 this week', rising: true },
        call: 'Fill up before Tuesday 6AM',
        note: 'Kerosene bucks it at −₱0.45. Announced Monday, not yet in effect.',
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
    ],
    email: [
        {
            label: 'Personal',
            unreadCount: 12,
            items: [
                {
                    id: 'email-1',
                    from: 'Landlord',
                    subject: 'Re: Lease renewal',
                    summary: 'Waiting on your reply before Friday to lock in the renewed rate.',
                    important: true,
                },
                {
                    id: 'email-2',
                    from: 'BPI Alerts',
                    subject: 'Your statement is ready',
                    summary: 'Routine statement notice, nothing time-sensitive.',
                    important: false,
                },
            ],
        },
        {
            label: 'Work',
            unreadCount: 4,
            items: [
                {
                    id: 'email-3',
                    from: 'Maria (PM)',
                    subject: 'Sprint review moved to tomorrow AM',
                    summary: 'Meeting was pulled forward — check before the shift starts.',
                    important: true,
                },
            ],
        },
    ],
    calendar: [
        {
            label: 'Personal',
            events: [
                { id: 'cal-1', title: 'Gym', startLabel: '9:30 PM', location: null, duringShift: true },
                { id: 'cal-2', title: "Dentist — Dr. Reyes", startLabel: 'Tomorrow 2:00 PM', location: 'Makati Medical Center', duringShift: false },
            ],
        },
        {
            label: 'Work',
            events: [
                { id: 'cal-3', title: 'Sprint review', startLabel: 'Tomorrow 9:00 AM', location: 'Google Meet', duringShift: false },
                { id: 'cal-4', title: 'On-call handoff', startLabel: '11:00 PM', location: null, duringShift: true },
            ],
        },
    ],
    gapsNote: null,
};

/**
 * Mock only — no budget source is wired up yet. Shown as-is regardless of
 * isLive, with its own "Mock data" meta line so it never reads as real.
 */
export const mockBudget: BudgetMock = {
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
