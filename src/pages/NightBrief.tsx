import { useEffect } from 'react';
import { useDispatch } from 'react-redux';
import { setPageTitle, toggleTheme } from '../store/themeConfigSlice';

import BudgetOverview from '../components/NightBrief/BudgetOverview';
import CardShell from '../components/NightBrief/CardShell';
import ClaimekBilling from '../components/NightBrief/ClaimekBilling';
import MarketWatch from '../components/NightBrief/MarketWatch';
import NightBackground from '../components/NightBrief/NightBackground';
import RainChart from '../components/NightBrief/RainChart';
import RefreshButton from '../components/NightBrief/RefreshButton';
import StormRainStatus from '../components/NightBrief/StormRainStatus';
import Timeline from '../components/NightBrief/Timeline';
import { useBrief } from '../components/NightBrief/useBrief';
import { useBudget } from '../components/NightBrief/useBudget';
import { formatDateTime, useRefresh } from '../components/NightBrief/useRefresh';

import IconCircleCheck from '../components/Icon/IconCircleCheck';
import IconCode from '../components/Icon/IconCode';
import IconCpuBolt from '../components/Icon/IconCpuBolt';
import IconInfoTriangle from '../components/Icon/IconInfoTriangle';
import IconServer from '../components/Icon/IconServer';
import IconTrendingUp from '../components/Icon/IconTrendingUp';

const PH_ICONS = {
    success: <IconCircleCheck className="h-4 w-4" />,
    warning: <IconInfoTriangle className="h-4 w-4" />,
    info: <IconTrendingUp className="h-4 w-4" />,
};

const AI_ICONS = {
    primary: <IconCode className="h-4 w-4" />,
    secondary: <IconServer className="h-4 w-4" />,
    info: <IconCpuBolt className="h-4 w-4" />,
};

const NCR_LABEL = { yes: 'Yes', no: 'No', unknown: 'Unknown' } as const;

/** Each card's accent stripe as an "r g b" triplet: muted, and distinct from its neighbours. */
const ACCENT = {
    market: '167 139 250',
    ai: '34 211 238',
    ph: '244 114 182',
    billing: '251 146 60',
    budget: '134 239 172',
} as const;

/** The work-from-home card doesn't spell the call out, so its colour carries it. */
const VERDICT = {
    office: { accent: '74 222 155', label: 'Office is fine' },
    watch: { accent: '240 180 94', label: 'Watch it' },
    wfh: { accent: '255 123 134', label: 'Call work from home' },
} as const;

const NightBrief = () => {
    const dispatch = useDispatch();
    const { data, isLive, reload } = useBrief();

    // Each card refreshes independently, but the header button can fire them all at once.
    // Every card re-fetches the same brief, so a click on any icon updates every card's
    // "Extracted" time together — there is only one real extraction per run.
    const weatherRefresh = useRefresh(reload);
    const billingRefresh = useRefresh(reload);
    const aiRefresh = useRefresh(reload);
    const phRefresh = useRefresh(reload);
    const marketRefresh = useRefresh(reload);

    // The Budget card has its own source: the local expense ledger (see useBudget). Refreshing it
    // just re-reads that ledger — no model call — and it is part of "Refresh all".
    const { budget, status: budgetStatus, reload: reloadBudget } = useBudget();
    const budgetRefresh = useRefresh(reloadBudget);
    const cards = [weatherRefresh, billingRefresh, aiRefresh, phRefresh, marketRefresh, budgetRefresh];

    const anyBusy = cards.some((c) => c.busy);
    const refreshAll = () => cards.forEach((c) => c.refresh());

    const updatedAt = isLive && data.generatedAt ? new Date(data.generatedAt) : null;

    useEffect(() => {
        dispatch(setPageTitle('Night Brief'));
        // The brief is a dark-only dashboard; it is read at night on a bright screen.
        dispatch(toggleTheme('dark'));
    }, [dispatch]);

    const { brief, verdict, weatherHours, fuel, coins, aiNews, phNews, claimekBilling, gapsNote } = data;
    const hasBilling = claimekBilling !== null && claimekBilling.providers.length > 0;

    // The work-from-home checks are a short checklist under the rain chart, not a paragraph.
    const verdictRows = [
        { label: 'NCR Govt work suspension', value: NCR_LABEL[verdict.ncrSuspension], flag: verdict.ncrSuspension === 'yes' },
        {
            label: 'Jacket / Sweatshirt',
            value: verdict.jacket ? `${verdict.jacket}${verdict.lowTempC !== null ? ` · ${verdict.lowTempC}°C low` : ''}` : 'Unknown',
            flag: verdict.jacket === 'Recommended',
        },
    ];

    const call = VERDICT[verdict.call];

    const entries = budget.entriesThisMonth ?? 0;
    const budgetMeta =
        budgetStatus === 'live'
            ? `From your Telegram expense log · ${entries} ${entries === 1 ? 'entry' : 'entries'} this month`
            : budgetStatus === 'not-configured'
              ? 'Sample data — the Telegram expense bot is not set up yet'
              : budgetStatus === 'outdated'
                ? 'Sample data — restart the backend to load the budget update'
                : 'Sample data — the backend is not reachable';
    const budgetStamp = budgetStatus === 'live' && budget.asOf ? new Date(budget.asOf) : null;

    const rainPeak = weatherHours.length > 0 ? weatherHours.reduce((best, h) => (h.tonight > best.tonight ? h : best), weatherHours[0]) : null;

    return (
        <>
            <NightBackground />
            <div className="nb-page relative z-[1] mx-auto max-w-[1400px] px-4 pb-14 pt-5">
                {/* Title strip stands in for the hidden sidebar and header. */}
                <div className="mb-4.5 flex flex-wrap items-center gap-x-4 gap-y-2.5">
                    <span className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-secondary">Night Brief</span>
                    <span className="text-[13.5px] nb-num text-[#888ea8]">
                        <b className="font-bold text-white-light">{brief.dateLabel}</b> &middot; {brief.windowLabel} &middot; {brief.place}
                    </span>

                    <div className="ml-auto flex items-center gap-3">
                        {isLive ? (
                            <span className="nb-num text-[11px] text-[#8794b3]">{anyBusy ? 'Refreshing…' : `Extracted ${formatDateTime(updatedAt!)}`}</span>
                        ) : (
                            <span className="inline-flex items-center gap-1.5 rounded-full border border-dashed border-warning/45 bg-warning/[0.12] px-3 py-1 text-[10.5px] font-extrabold uppercase tracking-[0.14em] text-warning">
                                <span className="h-1.5 w-1.5 rounded-full bg-warning" />
                                Sample data &middot; layout preview
                            </span>
                        )}

                        <RefreshButton
                            section="the whole brief"
                            busy={anyBusy}
                            onClick={refreshAll}
                            className="whitespace-nowrap border border-[#2a3f63] bg-[#1b2e4b] px-3 py-1.5 text-[12px] font-bold text-white-light hover:border-primary hover:bg-[#243d63] hover:text-primary"
                            label="Refresh all"
                        />
                    </div>
                </div>

                <div className="grid grid-cols-12 gap-4.5">
                    {/* ROW 1 — CLAIMEK BILLING, MARKET WATCH and WEATHER, a third of the row each.
                        Weather's colour carries the work-from-home call. Billing is absent when neither OpenAI nor AWS billing is
                        configured, which leaves the last third empty. */}
                    {hasBilling && (
                        <div className="col-span-12 md:col-span-6 xl:col-span-4">
                            <CardShell title="Claimek Billing" accent={ACCENT.billing} busy={billingRefresh.busy} updatedAt={updatedAt} onRefresh={billingRefresh.refresh}>
                                <ClaimekBilling billing={claimekBilling!} />
                            </CardShell>
                        </div>
                    )}

                    <div className="col-span-12 md:col-span-6 xl:col-span-4">
                        <CardShell title="Market Watch" accent={ACCENT.market} busy={marketRefresh.busy} updatedAt={updatedAt} onRefresh={marketRefresh.refresh}>
                            <MarketWatch fuel={fuel} coins={coins} />
                        </CardShell>
                    </div>

                    <div className="col-span-12 xl:col-span-4">
                        <CardShell
                            title="Weather"
                            accent={call.accent}
                            tint
                            groupLabel={`Work-from-home call: ${call.label}`}
                            busy={weatherRefresh.busy}
                            updatedAt={updatedAt}
                            onRefresh={weatherRefresh.refresh}
                        >
                            {/* Storm and rain warnings sit on their own line under the title (a header is too narrow for them at a third of the row);
                                the chart is shorter; the checks are tight two-line rows. */}
                            <div className="flex h-full flex-col">
                                <StormRainStatus align="start" cyclone={verdict.cyclone} rainfall={verdict.rainfall} />

                                <div className="mt-3 flex flex-1 flex-col">
                                    <div className="mb-1 text-xs text-[#a9b6d2]">
                                        {rainPeak ? `Chance of rain · ${brief.windowLabel} · peaks ${rainPeak.tonight}% at ${rainPeak.label}` : `Chance of rain · ${brief.windowLabel}`}
                                    </div>
                                    {weatherHours.length > 0 ? (
                                        <RainChart hours={weatherHours} height={92} fill />
                                    ) : (
                                        <div className="py-4 text-sm text-[#8794b3]">Weather data unavailable this run.</div>
                                    )}
                                </div>

                                <dl className="mt-3 divide-y divide-white/[0.08] border-t border-white/[0.08] text-[14px]">
                                    {verdictRows.map((row) => (
                                        <div key={row.label} className="flex items-center justify-between gap-3 py-1.5">
                                            <dt className="text-[#9aa8c4]">{row.label}</dt>
                                            <dd className={row.flag ? 'nb-chip-flag rounded px-2 py-0.5 text-right font-extrabold' : 'text-right font-semibold text-white-light'}>{row.value}</dd>
                                        </div>
                                    ))}
                                </dl>
                            </div>
                        </CardShell>
                    </div>

                    {/* ROW 2 — AI & CLAUDE and PHILIPPINES */}
                    <div className="col-span-12 xl:col-span-6">
                        <CardShell title={'AI & Claude'} accent={ACCENT.ai} busy={aiRefresh.busy} updatedAt={updatedAt} onRefresh={aiRefresh.refresh}>
                            {aiNews.length > 0 ? <Timeline items={aiNews} icons={AI_ICONS} /> : <div className="py-6 text-sm text-[#8794b3]">No AI/Claude items today.</div>}
                        </CardShell>
                    </div>

                    <div className="col-span-12 xl:col-span-6">
                        <CardShell title="Philippines" accent={ACCENT.ph} busy={phRefresh.busy} updatedAt={updatedAt} onRefresh={phRefresh.refresh}>
                            {phNews.length > 0 ? <Timeline items={phNews} icons={PH_ICONS} /> : <div className="py-6 text-sm text-[#8794b3]">No Philippines items today.</div>}
                        </CardShell>
                    </div>

                    {/* ROW 3 — BUDGET (half width; the other half is free for a future card). */}
                    {/* BUDGET — real spending from the Telegram expense log once the bot is set up; until then the sample, labelled as sample data. */}
                    <div className="col-span-12 md:col-span-6">
                        <CardShell title="Budget" accent={ACCENT.budget} meta={budgetMeta} busy={budgetRefresh.busy} updatedAt={budgetStamp} onRefresh={budgetRefresh.refresh}>
                            <BudgetOverview budget={budget} />
                        </CardShell>
                    </div>
                </div>

                {gapsNote && (
                    <div className="mt-4.5 border-t border-[#2a3f63] pt-3.5 text-xs leading-relaxed text-[#8794b3]">
                        <b className="font-bold text-[#888ea8]">Gaps:</b> {gapsNote}
                    </div>
                )}
            </div>
        </>
    );
};

export default NightBrief;
