import { FC } from 'react';
import { WeatherHour } from '../../data/nightBrief';

interface RainChartProps {
    hours: WeatherHour[];
    /** Plot height in px — or, with `fill`, the minimum height. */
    height?: number;
    /** Grow to the height the parent gives it (the parent must be a flex column with a set height). */
    fill?: boolean;
}

const BAR = '#805dca';
const DEFAULT_HEIGHT = 116;

/** Hourly chance of rain across the 8PM-7AM window. Deliberately minimal: bars,
 * a dashed 50% line, a label every other hour, and a tooltip for the exact
 * number. The peak is stated in the card's subtitle, not on the chart. */
const RainChart: FC<RainChartProps> = ({ hours, height = DEFAULT_HEIGHT, fill = false }) => (
    <div className={fill ? 'flex h-full flex-col' : undefined}>
        <div className={fill ? 'relative flex-1' : 'relative'} style={fill ? { minHeight: height } : { height }}>
            <div className="absolute inset-x-0 border-t border-dashed border-[#2c4470]/70" style={{ top: '50%' }} aria-hidden="true" />

            <div className="absolute inset-0 flex">
                {hours.map((h, i) => {
                    // Keep the tooltip inside the card: even hidden, one hanging past the
                    // last bar widens the page on a phone.
                    const tipPosition = i < 2 ? 'left-0' : i > hours.length - 3 ? 'right-0' : 'left-1/2 -translate-x-1/2';

                    return (
                        <div key={h.label} tabIndex={0} className="group relative flex flex-1 items-end justify-center outline-none">
                            <div
                                className="w-2.5 max-w-[60%] rounded-t-[3px] group-focus-visible:ring-2 group-focus-visible:ring-primary"
                                style={{ height: `${h.tonight}%`, minHeight: 2, background: BAR }}
                            />

                            <div
                                className={`pointer-events-none absolute bottom-full z-10 -translate-y-1.5 whitespace-nowrap rounded border border-[#2c4470] bg-[#1b2e4b] px-2.5 py-1.5 text-[11.5px] nb-num text-white-light opacity-0 transition-opacity group-hover:opacity-100 group-focus:opacity-100 ${tipPosition}`}
                            >
                                {h.label} &middot; {h.tonight}% chance of rain
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>

        <div className="mt-1.5 flex">
            {hours.map((h, i) => (
                <div key={h.label} className="nb-num flex-1 whitespace-nowrap text-center text-[10px] text-[#9aa8c4]">
                    {i % 2 === 0 ? h.label : ''}
                </div>
            ))}
        </div>
    </div>
);

export default RainChart;
