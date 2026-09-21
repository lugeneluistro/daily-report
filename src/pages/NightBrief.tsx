import { CSSProperties, useEffect } from 'react';
import { useDispatch } from 'react-redux';
import { setPageTitle, toggleTheme } from '../store/themeConfigSlice';

import BudgetOverview from '../components/NightBrief/BudgetOverview';
import CalendarAccounts from '../components/NightBrief/CalendarAccounts';
import CardShell from '../components/NightBrief/CardShell';
import ClaimekBilling from '../components/NightBrief/ClaimekBilling';
import EmailAccounts from '../components/NightBrief/EmailAccounts';
import NightBackground from '../components/NightBrief/NightBackground';
import RainChart from '../components/NightBrief/RainChart';
import RefreshButton from '../components/NightBrief/RefreshButton';
import Sparkline from '../components/NightBrief/Sparkline';
import Timeline from '../components/NightBrief/Timeline';
import { useBrief } from '../components/NightBrief/useBrief';
import { formatDateTime, useRefresh } from '../components/NightBrief/useRefresh';

import IconCircleCheck from '../components/Icon/IconCircleCheck';
import IconCode from '../components/Icon/IconCode';
import IconCpuBolt from '../components/Icon/IconCpuBolt';
import IconInfoTriangle from '../components/Icon/IconInfoTriangle';
import IconServer from '../components/Icon/IconServer';
import IconTrendingUp from '../components/Icon/IconTrendingUp';

import { mockBudget } from '../data/nightBrief';

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
const isClear = (value: string) => /^(none|unknown)$/i.test(value);

/** Each card's accent stripe as an "r g b" triplet: muted, and distinct from its neighbours. */
const ACCENT = {
    calendar: '96 165 250',
    fuel: '224 164 88',
    rain: '167 139 250',
    crypto: '45 212 191',
    ai: '34 211 238',
    ph: '244 114 182',
    email: '129 140 248',
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
    const calendarRefresh = useRefresh(reload);
    const fuelRefresh = useRefresh(reload);
    const heroRefresh = useRefresh(reload);
    const weatherRefresh = useRefresh(reload);
    const cryptoRefresh = useRefresh(reload);
    const aiRefresh = useRefresh(reload);
    const phRefresh = useRefresh(reload);
    const emailRefresh = useRefresh(reload);
    const billingRefresh = useRefresh(reload);
    const cards = [calendarRefresh, fuelRefresh, heroRefresh, weatherRefresh, cryptoRefresh, aiRefresh, phRefresh, emailRefresh, billingRefresh];

    // Budget is mock-only (no integration yet), so its refresh is purely
    // decorative and stays out of "Refresh all" — there is nothing real to pull.
    const budgetRefresh = useRefresh();

    const anyBusy = cards.some((c) => c.busy);
    const refreshAll = () => cards.forEach((c) => c.refresh());

    const updatedAt = isLive && data.generatedAt ? new Date(data.generatedAt) : null;

    useEffect(() => {
        dispatch(setPageTitle('Night Brief'));
        // The brief is a dark-only dashboard; it is read at night on a bright screen.
        dispatch(toggleTheme('dark'));
    }, [dispatch]);

    const { brief, verdict, weatherHours, fuel, coins, aiNews, phNews, email, calendar, claimekBilling, gapsNote } = data;
    const gasoline = fuel?.gasoline ?? null;
    const hasFuel = fuel !== null && (gasoline !== null || fuel.call !== null);
    const hasEmail = email !== null && email.length > 0;
    const hasCalendar = calendar !== null && calendar.length > 0;
    const hasBilling = claimekBilling !== null && claimekBilling.providers.length > 0;

    // The work-from-home card is a short checklist, not a paragraph.
    const verdictRows = [
        { label: 'NCR Govt work suspension', value: NCR_LABEL[verdict.ncrSuspension], flag: verdict.ncrSuspension === 'yes' },
        { label: 'Cyclone', value: verdict.cyclone, flag: !isClear(verdict.cyclone) },
        { label: 'Rainfall warning', value: verdict.rainfall, flag: !isClear(verdict.rainfall) },
        {
            label: 'Jacket / Sweatshirt',
            value: verdict.jacket ? `${verdict.jacket}${verdict.lowTempC !== null ? ` · ${verdict.lowTempC}°C low` : ''}` : 'Unknown',
            flag: verdict.jacket === 'Recommended',
        },
    ];

    const call = VERDICT[verdict.call];

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
                    {/* ROW 1 — CALENDAR reminders (absent without a Google account) and FUEL (absent if the week's adjustment wasn't found) */}
                    {hasCalendar && (
                        <div className={`col-span-12 ${hasFuel ? 'xl:col-span-8' : ''}`}>
                            <CardShell title="Calendar" accent={ACCENT.calendar} compact busy={calendarRefresh.busy} updatedAt={updatedAt} onRefresh={calendarRefresh.refresh}>
                                <CalendarAccounts accounts={calendar!} />
                            </CardShell>
                        </div>
                    )}

                    {hasFuel && (
                        <div className={`col-span-12 ${hasCalendar ? 'xl:col-span-4' : ''}`}>
                            <CardShell title="Fuel" accent={ACCENT.fuel} compact busy={fuelRefresh.busy} updatedAt={updatedAt} onRefresh={fuelRefresh.refresh}>
                                {/* Alone on the row (no Calendar): lay it out sideways instead of stretching a tall card across the page. */}
                                <div className={hasCalendar ? '' : 'flex flex-wrap items-end gap-x-14 gap-y-3'}>
                                    {gasoline && (
                                        <div>
                                            <div className="mb-0.5 text-[13px] text-[#888ea8]">{gasoline.label}</div>
                                            <div
                                                className={`text-[23px] font-extrabold leading-tight nb-num tracking-tight ${
                                                    gasoline.price ? 'text-[#e9b45f]' : gasoline.rising ? 'text-[#ff8b93]' : 'text-[#4ade9b]'
                                                }`}
                                            >
                                                {gasoline.price ?? `${gasoline.rising ? '▲' : '▼'} ${gasoline.delta}`}
                                            </div>
                                            {gasoline.price && gasoline.delta && (
                                                <div className={`mt-px text-xs font-bold nb-num ${gasoline.rising ? 'text-[#ff8b93]' : 'text-[#4ade9b]'}`}>
                                                    {gasoline.rising ? '▲' : '▼'} {gasoline.delta}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                    {fuel!.call && (
                                        <div className={gasoline && hasCalendar ? 'mt-3.5 border-t border-[#2a3f63] pt-3' : ''}>
                                            <div className="text-[11px] font-extrabold uppercase tracking-[0.12em] text-[#8794b3]">Best time to fuel</div>
                                            <div className="mt-1 text-base font-extrabold leading-snug text-[#a8bcff]">{fuel!.call}</div>
                                        </div>
                                    )}
                                </div>
                            </CardShell>
                        </div>
                    )}

                    {/* ROW 2 — WORK-FROM-HOME call, CHANCE OF RAIN and CRYPTO side by side */}
                    <div className="col-span-12 xl:col-span-4">
                        <div
                            className="panel nb-card nb-card-tint flex h-full flex-col"
                            style={{ '--nb-accent-rgb': call.accent } as CSSProperties}
                            role="group"
                            aria-label={`Work-from-home call: ${call.label}`}
                            title={call.label}
                        >
                            {/* The deadline chip stands in for a title so the refresh control sits top-right, like every other card. */}
                            <div className="mb-1 flex items-center justify-between gap-3">
                                <span className="nb-chip-accent whitespace-nowrap rounded-md px-3 py-1 text-xs font-extrabold uppercase tracking-wider">{verdict.deadline}</span>
                                <RefreshButton section="the work-from-home call" busy={heroRefresh.busy} onClick={heroRefresh.refresh} />
                            </div>

                            <dl className="flex flex-1 flex-col divide-y divide-white/[0.08] text-[14px]">
                                {verdictRows.map((row) => (
                                    <div key={row.label} className="flex flex-1 items-center justify-between gap-3 py-2.5">
                                        <dt className="text-[#9aa8c4]">{row.label}</dt>
                                        <dd className={row.flag ? 'nb-chip-flag rounded px-2 py-0.5 text-right font-extrabold' : 'text-right font-semibold text-white-light'}>{row.value}</dd>
                                    </div>
                                ))}
                            </dl>

                            <div className="nb-num mt-2.5 text-[11px] text-[#8794b3]">
                                {heroRefresh.busy ? 'Refreshing…' : updatedAt ? `Extracted ${formatDateTime(updatedAt)}` : 'Sample data · not yet extracted'}
                            </div>
                        </div>
                    </div>

                    <div className="col-span-12 md:col-span-6 xl:col-span-4">
                        <CardShell
                            title="Chance of rain"
                            accent={ACCENT.rain}
                            meta={rainPeak ? `${brief.windowLabel} · peaks ${rainPeak.tonight}% at ${rainPeak.label}` : brief.windowLabel}
                            busy={weatherRefresh.busy}
                            updatedAt={updatedAt}
                            onRefresh={weatherRefresh.refresh}
                        >
                            {weatherHours.length > 0 ? <RainChart hours={weatherHours} /> : <div className="py-6 text-sm text-[#8794b3]">Weather data unavailable this run.</div>}
                        </CardShell>
                    </div>

                    <div className="col-span-12 md:col-span-6 xl:col-span-4">
                        <CardShell title="Crypto" accent={ACCENT.crypto} meta="A coin up 500%+ in 24h is highlighted" busy={cryptoRefresh.busy} updatedAt={updatedAt} onRefresh={cryptoRefresh.refresh}>
                            {coins.length === 0 ? (
                                <div className="py-6 text-sm text-[#8794b3]">Prices unavailable this run.</div>
                            ) : (
                                <div className="flex flex-col gap-2.5">
                                    {coins.map((coin) => (
                                        <div
                                            key={coin.ticker}
                                            className={`flex items-center gap-3 rounded-md border bg-[#0d1628] px-3 py-2.5 ${coin.clearsGate ? 'border-success/50' : 'border-[#25385a]'}`}
                                        >
                                            <span
                                                className={`grid h-9 w-9 flex-none place-items-center rounded-[9px] text-[10.5px] font-extrabold ${
                                                    coin.clearsGate ? 'bg-success/[0.16] text-[#4ade9b]' : 'bg-[#5f6b85]/[0.18] text-[#8d99b3]'
                                                }`}
                                            >
                                                {coin.ticker}
                                            </span>
                                            <span className="min-w-0 flex-1">
                                                <span className="block truncate text-[13px] text-white-light">
                                                    {coin.name}
                                                    {coin.clearsGate && (
                                                        <span className="ml-1.5 rounded-[3px] bg-success/[0.14] px-1.5 py-px align-[1px] text-[9px] font-extrabold uppercase tracking-[0.1em] text-[#4ade9b]">
                                                            500%+
                                                        </span>
                                                    )}
                                                </span>
                                                <span className="block text-xs nb-num text-[#888ea8]">{coin.price}</span>
                                            </span>
                                            <span className="w-[68px] flex-none">
                                                <Sparkline
                                                    values={coin.series}
                                                    width={68}
                                                    height={28}
                                                    padding={3}
                                                    stretch
                                                    stroke={coin.clearsGate ? '#00ab55' : '#5f6b85'}
                                                    fill={coin.clearsGate ? 'rgba(0,171,85,0.28)' : 'rgba(95,107,133,0.22)'}
                                                    className="h-[28px]"
                                                    label={`${coin.name} over 24 hours, ${coin.change}`}
                                                />
                                            </span>
                                            <span className={`w-[62px] flex-none text-right text-[15px] font-extrabold nb-num ${coin.clearsGate ? 'text-[#4ade9b]' : 'text-[#888ea8]'}`}>
                                                {coin.change}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </CardShell>
                    </div>

                    {/* ROW 3 — AI & CLAUDE and PHILIPPINES */}
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

                    {/* ROW 4 — EMAIL (absent when no Gmail account is configured) and CLAIMEK BILLING (absent when neither OpenAI nor AWS billing is configured).
                        Whichever is missing, the other takes the full row. */}
                    {hasEmail && (
                        <div className={`col-span-12 ${hasBilling ? 'xl:col-span-6' : ''}`}>
                            <CardShell title="Email" accent={ACCENT.email} compact busy={emailRefresh.busy} updatedAt={updatedAt} onRefresh={emailRefresh.refresh}>
                                <EmailAccounts accounts={email!} />
                            </CardShell>
                        </div>
                    )}

                    {hasBilling && (
                        <div className={`col-span-12 ${hasEmail ? 'xl:col-span-6' : ''}`}>
                            <CardShell title="Claimek Billing" accent={ACCENT.billing} compact busy={billingRefresh.busy} updatedAt={updatedAt} onRefresh={billingRefresh.refresh}>
                                <ClaimekBilling billing={claimekBilling!} />
                            </CardShell>
                        </div>
                    )}

                    {/* BUDGET — mock data, no integration yet. Always shown, never claims to be live. Half width from tablet up. */}
                    <div className="col-span-12 md:col-span-6">
                        <CardShell title="Budget" accent={ACCENT.budget} meta="Mock data — no bank integration yet" busy={budgetRefresh.busy} updatedAt={null} onRefresh={budgetRefresh.refresh}>
                            <BudgetOverview budget={mockBudget} />
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
