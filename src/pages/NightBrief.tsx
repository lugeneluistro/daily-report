import { useEffect } from 'react';
import { useDispatch } from 'react-redux';
import { setPageTitle, toggleTheme } from '../store/themeConfigSlice';

import BudgetOverview from '../components/NightBrief/BudgetOverview';
import CalendarAccounts from '../components/NightBrief/CalendarAccounts';
import CardShell from '../components/NightBrief/CardShell';
import ClaimekBilling from '../components/NightBrief/ClaimekBilling';
import EmailAccounts from '../components/NightBrief/EmailAccounts';
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

import { FuelSide, mockBudget } from '../data/nightBrief';

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

const CRYPTO_GRID_COLS: Record<number, string> = {
    1: 'sm:grid-cols-1 max-w-xs',
    2: 'sm:grid-cols-2',
};

const NightBrief = () => {
    const dispatch = useDispatch();
    const { data, isLive, reload } = useBrief();

    // Each card refreshes independently, but the header button can fire them all at once.
    // All six re-fetch the same nightly file, so a click on any icon updates every card's
    // "Extracted" time together — there is only one real extraction per night.
    const fuelRefresh = useRefresh(reload);
    const heroRefresh = useRefresh(reload);
    const weatherRefresh = useRefresh(reload);
    const phRefresh = useRefresh(reload);
    const aiRefresh = useRefresh(reload);
    const cryptoRefresh = useRefresh(reload);
    const emailRefresh = useRefresh(reload);
    const calendarRefresh = useRefresh(reload);
    const billingRefresh = useRefresh(reload);
    const cards = [fuelRefresh, heroRefresh, weatherRefresh, phRefresh, aiRefresh, cryptoRefresh, emailRefresh, calendarRefresh, billingRefresh];

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
    const hasFuel = fuel !== null;
    const hasCrypto = coins.length > 0;
    const hasEmail = email !== null && email.length > 0;
    const hasCalendar = calendar !== null && calendar.length > 0;
    const hasBilling = claimekBilling !== null && claimekBilling.providers.length > 0;
    const fuelSides = fuel ? [fuel.diesel, fuel.gasoline].filter((f): f is FuelSide => f !== null) : [];

    return (
        <div className="mx-auto max-w-[1400px] px-4 pb-14 pt-5">
            {/* Title strip stands in for the hidden sidebar and header. */}
            <div className="mb-4.5 flex flex-wrap items-center gap-x-4 gap-y-2.5">
                <span className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-secondary">Night Brief</span>
                <span className="text-[13.5px] tabular-nums text-[#888ea8]">
                    <b className="font-bold text-white-light">{brief.dateLabel}</b> &middot; {brief.windowLabel} &middot; {brief.place}
                </span>

                <div className="ml-auto flex items-center gap-3">
                    {isLive ? (
                        <span className="text-[11px] text-[#5f6b85]">{anyBusy ? 'Refreshing…' : `Extracted ${formatDateTime(updatedAt!)}`}</span>
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
                        className="border border-[#2a3f63] bg-[#1b2e4b] px-3 py-1.5 text-[12px] font-bold text-white-light hover:border-primary hover:bg-[#243d63] hover:text-primary"
                        label="Refresh all"
                    />
                </div>
            </div>

            <div className="grid grid-cols-12 gap-4.5">
                {/* FUEL — absent when the week's adjustment couldn't be found */}
                {hasFuel && (
                    <div className="col-span-12 xl:col-span-5">
                        <CardShell title="Fuel" busy={fuelRefresh.busy} updatedAt={updatedAt} onRefresh={fuelRefresh.refresh}>
                            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                                {fuelSides.map((f) => (
                                    <div key={f.label}>
                                        <div className="mb-0.5 text-[13px] text-[#888ea8]">{f.label}</div>
                                        <div
                                            className={`text-[23px] font-extrabold leading-tight tabular-nums tracking-tight ${
                                                f.label === 'Diesel' ? 'text-[#f37f87]' : 'text-[#e9b45f]'
                                            }`}
                                        >
                                            {f.price}
                                        </div>
                                        {f.delta && (
                                            <div className={`mt-px text-xs font-bold tabular-nums ${f.rising ? 'text-[#ff8b93]' : 'text-[#4ade9b]'}`}>
                                                {f.rising ? '▲' : '▼'} {f.delta}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                            {(fuel!.call || fuel!.note) && (
                                <div className="mt-4.5 flex flex-wrap items-baseline gap-x-3.5 gap-y-1.5 border-t border-[#1b2e4b] pt-3.5">
                                    {fuel!.call && <span className="font-extrabold text-[#a8bcff]">{fuel!.call}</span>}
                                    {fuel!.note && <span className="text-xs text-[#888ea8]">{fuel!.note}</span>}
                                </div>
                            )}
                        </CardShell>
                    </div>
                )}

                {/* WFH VERDICT — widens to fill the row when Fuel is absent */}
                <div className={`col-span-12 ${hasFuel ? 'xl:col-span-7' : 'xl:col-span-12'}`}>
                    <div className="relative flex h-full flex-col gap-3.5 overflow-hidden rounded-md bg-warning p-6 text-[#1f1607]">
                        <span className="pointer-events-none absolute -right-[16%] -top-[38%] h-[176%] w-[62%] rounded-full bg-[#c9891a]" aria-hidden="true" />

                        <div className="relative flex flex-wrap items-start justify-between gap-4">
                            <div>
                                <div className="text-[15px] font-bold opacity-80">Work-from-home call</div>
                                <div className="mt-2.5 inline-flex items-center gap-1.5 rounded-md bg-black/[0.16] px-2.5 py-1.5 text-[13px] font-bold tabular-nums">{verdict.binding}</div>
                            </div>
                            <div className="text-right">
                                <RefreshButton
                                    section="the work-from-home call"
                                    busy={heroRefresh.busy}
                                    onClick={heroRefresh.refresh}
                                    className="text-[#1f1607]/70 hover:bg-black/10 hover:text-[#1f1607]"
                                />
                                <div className="text-[30px] font-extrabold leading-none tracking-tight [text-wrap:balance]">{verdict.title}</div>
                                <span className="mt-2 inline-block rounded-[5px] bg-black/20 px-2.5 py-1 text-xs font-bold">{verdict.signal}</span>
                            </div>
                        </div>

                        <p className="relative m-0 max-w-[60ch] text-[14.5px] leading-normal text-[#33240a]">{verdict.reason}</p>

                        <div className="relative mt-auto flex flex-wrap items-center justify-between gap-3.5">
                            <div className="flex flex-wrap gap-2">
                                {verdict.chips.map((c) => (
                                    <span key={c} className="inline-flex items-center gap-1.5 rounded-md bg-black/[0.16] px-2.5 py-1.5 text-[13px] font-bold tabular-nums">
                                        {c}
                                    </span>
                                ))}
                            </div>
                            <span className="whitespace-nowrap rounded-md border-[1.5px] border-[#1f1607]/50 px-3.5 py-1.5 text-xs font-extrabold uppercase tracking-wider">{verdict.deadline}</span>
                        </div>

                        <div className="relative text-[11px] text-[#1f1607]/55">
                            {heroRefresh.busy ? 'Refreshing…' : updatedAt ? `Extracted ${formatDateTime(updatedAt)}` : 'Sample data · not yet extracted'}
                        </div>
                    </div>
                </div>

                {/* WEATHER */}
                <div className="col-span-12 xl:col-span-8">
                    <CardShell title={`Weather · ${brief.windowLabel}`} busy={weatherRefresh.busy} updatedAt={updatedAt} onRefresh={weatherRefresh.refresh}>
                        {weatherHours.length > 0 ? <RainChart hours={weatherHours} /> : <div className="py-6 text-sm text-[#5f6b85]">Weather data unavailable this run.</div>}
                    </CardShell>
                </div>

                {/* PHILIPPINES */}
                <div className="col-span-12 xl:col-span-4">
                    <CardShell title="Philippines" busy={phRefresh.busy} updatedAt={updatedAt} onRefresh={phRefresh.refresh}>
                        {phNews.length > 0 ? <Timeline items={phNews} icons={PH_ICONS} /> : <div className="py-6 text-sm text-[#5f6b85]">No Philippines items today.</div>}
                    </CardShell>
                </div>

                {/* AI AND CLAUDE — widens to fill the row when Crypto is absent */}
                <div className={`col-span-12 ${hasCrypto ? 'xl:col-span-5' : 'xl:col-span-12'}`}>
                    <CardShell title={'AI & Claude'} busy={aiRefresh.busy} updatedAt={updatedAt} onRefresh={aiRefresh.refresh}>
                        {aiNews.length > 0 ? <Timeline items={aiNews} icons={AI_ICONS} /> : <div className="py-6 text-sm text-[#5f6b85]">No AI/Claude items today.</div>}
                    </CardShell>
                </div>

                {/* CRYPTO — absent unless a coin clears the +500% gate */}
                {hasCrypto && (
                    <div className="col-span-12 xl:col-span-7">
                        <CardShell
                            title="Crypto"
                            meta="Only a coin above +500% in 24h renders on a live run"
                            busy={cryptoRefresh.busy}
                            updatedAt={updatedAt}
                            onRefresh={cryptoRefresh.refresh}
                        >
                            <div className={`grid grid-cols-1 gap-4 ${CRYPTO_GRID_COLS[coins.length] ?? 'sm:grid-cols-3'}`}>
                                {coins.map((coin) => (
                                    <div key={coin.ticker} className="flex flex-col overflow-hidden rounded-md border border-[#1b2e4b] bg-[#101a2d]">
                                        <div className="flex items-center gap-3 px-4 pt-4">
                                            <span
                                                className={`grid h-[42px] w-[42px] flex-none place-items-center rounded-[10px] text-[11px] font-extrabold ${
                                                    coin.clearsGate ? 'bg-success/[0.16] text-[#4ade9b]' : 'bg-[#5f6b85]/[0.18] text-[#8d99b3]'
                                                }`}
                                            >
                                                {coin.ticker}
                                            </span>
                                            <span className="min-w-0">
                                                <span className={`block text-[21px] font-extrabold leading-tight tabular-nums tracking-tight ${coin.clearsGate ? 'text-[#4ade9b]' : 'text-[#888ea8]'}`}>
                                                    {coin.change}
                                                </span>
                                                <span className="block truncate text-xs text-[#888ea8]">
                                                    {coin.name} &middot; {coin.price}
                                                </span>
                                            </span>
                                        </div>

                                        <span
                                            className={`mx-4 mt-2.5 self-start rounded-[3px] px-1.5 py-0.5 text-[9.5px] font-extrabold uppercase tracking-[0.1em] ${
                                                coin.clearsGate ? 'bg-success/[0.14] text-[#4ade9b]' : 'bg-[#5f6b85]/[0.14] text-[#5f6b85]'
                                            }`}
                                        >
                                            {coin.clearsGate ? 'Clears the gate' : 'Held back'}
                                        </span>

                                        <div className="mt-auto pt-3">
                                            <Sparkline
                                                values={coin.series}
                                                width={240}
                                                height={78}
                                                padding={6}
                                                stretch
                                                stroke={coin.clearsGate ? '#00ab55' : '#5f6b85'}
                                                fill={coin.clearsGate ? 'rgba(0,171,85,0.28)' : 'rgba(95,107,133,0.22)'}
                                                className="h-[78px]"
                                                label={`${coin.name} over 24 hours, ${coin.change}`}
                                            />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </CardShell>
                    </div>
                )}

                {/* EMAIL — absent when no Gmail account is configured */}
                {hasEmail && (
                    <div className="col-span-12">
                        <CardShell title="Email" busy={emailRefresh.busy} updatedAt={updatedAt} onRefresh={emailRefresh.refresh}>
                            <EmailAccounts accounts={email!} />
                        </CardShell>
                    </div>
                )}

                {/* CALENDAR — absent when no Google account is configured */}
                {hasCalendar && (
                    <div className="col-span-12">
                        <CardShell title="Calendar" busy={calendarRefresh.busy} updatedAt={updatedAt} onRefresh={calendarRefresh.refresh}>
                            <CalendarAccounts accounts={calendar!} />
                        </CardShell>
                    </div>
                )}

                {/* CLAIMEK BILLING — absent when neither OpenAI nor AWS billing is configured */}
                {hasBilling && (
                    <div className="col-span-12">
                        <CardShell title="Claimek Billing" busy={billingRefresh.busy} updatedAt={updatedAt} onRefresh={billingRefresh.refresh}>
                            <ClaimekBilling billing={claimekBilling!} />
                        </CardShell>
                    </div>
                )}

                {/* BUDGET — mock data, no integration yet. Always shown, never claims to be live. */}
                <div className="col-span-12">
                    <CardShell title="Budget" meta="Mock data — no bank integration yet" busy={budgetRefresh.busy} updatedAt={null} onRefresh={budgetRefresh.refresh}>
                        <BudgetOverview budget={mockBudget} />
                    </CardShell>
                </div>
            </div>

            {gapsNote && (
                <div className="mt-4.5 border-t border-[#1b2e4b] pt-3.5 text-xs leading-relaxed text-[#5f6b85]">
                    <b className="font-bold text-[#888ea8]">Gaps:</b> {gapsNote}
                </div>
            )}
        </div>
    );
};

export default NightBrief;
