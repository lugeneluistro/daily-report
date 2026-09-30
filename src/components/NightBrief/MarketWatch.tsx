import { FC } from 'react';
import { Coin, FuelInfo } from '../../data/nightBrief';
import Sparkline from './Sparkline';

interface MarketWatchProps {
    /** Null, or nothing found for this week, when the fuel adjustment couldn't be extracted. */
    fuel: FuelInfo | null;
    coins: Coin[];
}

const SECTION_LABEL = 'text-[10.5px] font-extrabold uppercase tracking-[0.12em] text-[#8794b3]';

/** "+₱0.90 this week" -> the amount, and the period in small type under it. Anything else is shown whole. */
const splitDelta = (delta: string) => {
    const m = delta.match(/^\s*([+−–-]?\s*₱?\s*\d[\d.,]*)\s*(.*)$/);
    return m ? { amount: m[1].trim(), period: m[2].trim() } : { amount: delta.trim(), period: '' };
};

/**
 * Just the three things worth a glance: the pump price, how far it is about to
 * move, and when to fill up. Price up is bad news (red), price down is good
 * (green). Either half can be missing — the news often gives the change but not
 * the price — and the strip shows only what was found.
 */
const FuelStrip: FC<{ fuel: FuelInfo }> = ({ fuel }) => {
    const { gasoline, call } = fuel;
    const move = gasoline && gasoline.delta ? splitDelta(gasoline.delta) : null;
    const trend = gasoline?.rising ? 'text-[#ff8b93]' : 'text-[#4ade9b]';

    return (
        <div className="rounded-md border border-[#25385a] bg-[#0d1628] px-3 py-2.5">
            {gasoline && (
                <div className="flex items-center gap-3">
                    <span className="grid h-9 w-9 flex-none place-items-center rounded-[9px] bg-[#e2a03f]/[0.16] text-[10.5px] font-extrabold text-[#f0b45e]">GAS</span>

                    <span className="min-w-0 flex-1">
                        <span className="block text-[13px] text-white-light">{gasoline.label}</span>
                        {gasoline.price ? (
                            <span className="block text-[17px] font-extrabold leading-tight nb-num text-[#e9b45f]">{gasoline.price}</span>
                        ) : (
                            <span className="block text-xs text-[#8794b3]">Pump price not reported</span>
                        )}
                    </span>

                    {move && (
                        <span className="flex-none text-right">
                            <span className={`block text-[15px] font-extrabold nb-num ${trend}`}>
                                {gasoline.rising ? '▲' : '▼'} {move.amount}
                            </span>
                            {move.period && <span className="block text-[11px] text-[#8794b3]">{move.period}</span>}
                        </span>
                    )}
                </div>
            )}

            {call && (
                <div className={`flex flex-wrap items-baseline gap-x-2 gap-y-0.5 ${gasoline ? 'mt-2.5 border-t border-[#25385a] pt-2' : ''}`}>
                    <span className={SECTION_LABEL}>Best time to fuel</span>
                    <span className="text-[13.5px] font-bold leading-snug text-[#a8bcff]">{call}</span>
                </div>
            )}
        </div>
    );
};

/** Fuel strip on top, the tracked coins below — the two things checked on the way into a shift. */
const MarketWatch: FC<MarketWatchProps> = ({ fuel, coins }) => {
    const hasFuel = fuel !== null && (fuel.gasoline !== null || fuel.call !== null);

    return (
        <div className="flex flex-col gap-4">
            {hasFuel && <FuelStrip fuel={fuel!} />}

            <div>
                <div className="mb-2 flex items-baseline justify-between gap-3">
                    <span className={SECTION_LABEL}>Crypto</span>
                    <span className="text-[11px] text-[#8794b3]">A coin up 500%+ in 24h is highlighted</span>
                </div>

                {coins.length === 0 ? (
                    <div className="py-6 text-sm text-[#8794b3]">Prices unavailable this run.</div>
                ) : (
                    <div className="flex flex-col gap-2.5">
                        {coins.map((coin) => (
                            <div key={coin.ticker} className={`flex items-center gap-3 rounded-md border bg-[#0d1628] px-3 py-2.5 ${coin.clearsGate ? 'border-success/50' : 'border-[#25385a]'}`}>
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
                                <span className={`w-[62px] flex-none text-right text-[15px] font-extrabold nb-num ${coin.clearsGate ? 'text-[#4ade9b]' : 'text-[#888ea8]'}`}>{coin.change}</span>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default MarketWatch;
