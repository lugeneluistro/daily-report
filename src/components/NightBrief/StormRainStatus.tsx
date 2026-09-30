import { FC } from 'react';
import { CycloneInfo, RainfallInfo } from '../../data/nightBrief';

interface StormRainStatusProps {
    cyclone: CycloneInfo;
    rainfall: RainfallInfo;
    /** 'end' (default) is the right-aligned header block; 'start' is a left-aligned line for the card body. */
    align?: 'end' | 'start';
}

/** The warning's own colour, as a dot plus a tinted chip. Full class names so Tailwind can see them. */
const WARNING_STYLE = {
    yellow: { label: 'Yellow', dot: 'bg-[#facc15]', chip: 'bg-[#facc15]/[0.16] text-[#fde68a]' },
    orange: { label: 'Orange', dot: 'bg-[#fb923c]', chip: 'bg-[#fb923c]/[0.18] text-[#fdba74]' },
    red: { label: 'Red', dot: 'bg-[#f87171]', chip: 'bg-[#f87171]/[0.18] text-[#fecaca]' },
} as const;

/** "Tropical Storm Ada (Kalmaegi)" — local name first, international name in brackets. */
const cycloneTitle = ({ category, localName, internationalName }: CycloneInfo) => {
    const names = localName && internationalName ? `${localName} (${internationalName})` : (localName ?? internationalName);
    return [category, names].filter(Boolean).join(' ') || 'Active cyclone';
};

const MUTED = 'text-[#9aa8c4]';
const FLAG = 'nb-chip-flag rounded px-2 py-0.5 font-extrabold';

/**
 * Both hazards in one right-aligned block for a card header: the cyclone
 * (named, when there is one) and the rainfall warning over NCR, coloured as
 * PAGASA colours it. Colour never carries the meaning alone — the level is
 * spelled out too. Never shorter than the refresh button beside it, so a single
 * chip lines up with the button and a taller block just grows downward.
 */
const StormRainStatus: FC<StormRainStatusProps> = ({ cyclone, rainfall, align = 'end' }) => {
    const { level, until, heavyRainLikely } = rainfall;
    const alignClass = align === 'end' ? 'items-end text-right' : 'items-start text-left';
    const allClear = cyclone.status === 'none' && level === 'none' && !heavyRainLikely;

    return (
        <div className={`flex min-w-0 flex-col justify-center gap-1.5 text-[13px] ${alignClass} ${align === 'end' ? 'min-h-[28px]' : ''}`}>
            {allClear && <span className="font-semibold text-white-light">No cyclone or rain warning</span>}

            {cyclone.status === 'active' && (
                <div className={`flex flex-col gap-0.5 ${align === 'end' ? 'items-end' : 'items-start'}`}>
                    <span className={FLAG}>{cycloneTitle(cyclone)}</span>
                    <span className={`text-[12px] ${MUTED}`}>{cyclone.ncrSignal ? `Wind Signal No. ${cyclone.ncrSignal} over NCR` : 'No wind signal over NCR'}</span>
                </div>
            )}
            {cyclone.status === 'unknown' && <span className={MUTED}>Cyclone status unknown</span>}

            {level === 'yellow' || level === 'orange' || level === 'red' ? (
                <span className={`inline-flex items-center gap-2 rounded px-2 py-0.5 font-extrabold ${WARNING_STYLE[level].chip}`}>
                    <span className={`h-2 w-2 flex-none rounded-full ${WARNING_STYLE[level].dot}`} aria-hidden="true" />
                    {WARNING_STYLE[level].label} rainfall warning in NCR{until ? ` · until ${until}` : ''}
                </span>
            ) : level === 'unknown' ? (
                <span className={MUTED}>Rainfall warning unknown</span>
            ) : heavyRainLikely ? (
                <span className={FLAG}>Heavy rain likely in NCR</span>
            ) : (
                cyclone.status === 'active' && <span className={MUTED}>No rainfall warning in NCR</span>
            )}
        </div>
    );
};

export default StormRainStatus;
