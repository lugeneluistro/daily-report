import { FC } from 'react';
import { WeatherHour } from '../../data/nightBrief';

interface RainChartProps {
    hours: WeatherHour[];
}

/**
 * Two series, one scale: rain chance tonight against the same hours last night.
 *
 * Temperature deliberately is not plotted. A second y-axis on the same panel
 * makes both series unreadable, so the low and high are stated underneath.
 */
const TONIGHT = '#805dca';
const LAST_NIGHT = '#3f9fd6';
const TICKS = [100, 80, 60, 40, 20, 0];

const RainChart: FC<RainChartProps> = ({ hours }) => {
    const peak = hours.reduce((best, h) => (h.tonight > best.tonight ? h : best), hours[0]);
    const warmest = hours.reduce((best, h) => (h.temp > best.temp ? h : best), hours[0]);
    const coldest = hours.reduce((best, h) => (h.temp < best.temp ? h : best), hours[0]);

    return (
        <div className="overflow-x-auto">
            <div className="min-w-[560px]">
                <div className="flex gap-2.5">
                    <div className="relative h-[230px] w-[30px] flex-none text-[10.5px] tabular-nums text-[#5f6b85]" aria-hidden="true">
                        {TICKS.map((t) => (
                            <span key={t} className="absolute right-0 -translate-y-1/2" style={{ top: `${100 - t}%` }}>
                                {t}
                            </span>
                        ))}
                    </div>

                    <div className="relative h-[230px] min-w-0 flex-1">
                        {TICKS.map((t) => (
                            <div key={t} className="absolute inset-x-0 border-t border-[#1b2e4b]/70" style={{ top: `${100 - t}%` }} />
                        ))}

                        <div className="absolute inset-0 flex">
                            {hours.map((h) => (
                                <div key={h.label} tabIndex={0} className="group relative flex flex-1 items-end justify-center gap-[3px] outline-none">
                                    {h.label === peak.label && (
                                        <div
                                            className="absolute whitespace-nowrap text-[11px] font-extrabold tabular-nums text-[#c0a5f0]"
                                            style={{ bottom: `${h.tonight}%`, marginBottom: 8 }}
                                        >
                                            {h.tonight}%
                                        </div>
                                    )}

                                    <div
                                        className="w-2 max-w-[26%] rounded-t-[3px] group-focus-visible:ring-2 group-focus-visible:ring-primary"
                                        style={{ height: `${h.tonight}%`, background: TONIGHT }}
                                    />
                                    <div className="w-2 max-w-[26%] rounded-t-[3px]" style={{ height: `${h.lastNight}%`, background: LAST_NIGHT }} />

                                    <div className="pointer-events-none absolute bottom-full left-1/2 z-10 -translate-x-1/2 -translate-y-1.5 whitespace-nowrap rounded border border-[#2c4470] bg-[#1b2e4b] px-2.5 py-1.5 text-[11.5px] tabular-nums text-white-light opacity-0 transition-opacity group-hover:opacity-100 group-focus:opacity-100">
                                        {h.label} &middot; tonight {h.tonight}% &middot; last night {h.lastNight}%
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="ml-10 mt-2 flex">
                    {hours.map((h) => (
                        <div key={h.label} className="flex-1 text-center text-[10.5px] text-[#5f6b85]">
                            {h.label}
                        </div>
                    ))}
                </div>

                <div className="mt-3.5 flex justify-center gap-6 text-[13px] text-white-light">
                    <span className="inline-flex items-center gap-2">
                        <span className="h-2.5 w-2.5 flex-none rounded-[3px]" style={{ background: TONIGHT }} />
                        Tonight
                    </span>
                    <span className="inline-flex items-center gap-2">
                        <span className="h-2.5 w-2.5 flex-none rounded-[3px]" style={{ background: LAST_NIGHT }} />
                        Last night
                    </span>
                </div>
            </div>

            <div className="mt-3.5 border-t border-[#1b2e4b] pt-3 text-center text-xs text-[#888ea8]">
                Rain chance per hour, both nights on the same scale. Temperature runs{' '}
                <b className="font-bold text-white-light">
                    {warmest.temp}&deg;C at {warmest.label} down to {coldest.temp}&deg;C at {coldest.label}
                </b>
                .
            </div>
        </div>
    );
};

export default RainChart;
