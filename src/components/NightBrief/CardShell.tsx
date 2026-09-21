import { CSSProperties, FC, PropsWithChildren } from 'react';
import RefreshButton from './RefreshButton';
import { formatDateTime } from './useRefresh';

interface CardShellProps {
    title: string;
    /** Small note under the title row. */
    meta?: string;
    busy: boolean;
    /** Null on the sample fallback, which was never actually extracted. */
    updatedAt: Date | null;
    /** Reloads just this card. Also fired when the page-level "Refresh all" runs. */
    onRefresh: () => void;
    /** Tighter padding, title and spacing — for strips that shouldn't dominate the page. */
    compact?: boolean;
    /** The card's accent stripe as an "r g b" triplet, e.g. "96 165 250". */
    accent?: string;
    className?: string;
}

/**
 * The panel every night-brief section sits in: title, a per-card refresh
 * control, and the date/time that section's data was last extracted. The look
 * (surface, border, accent stripe) lives in NightBackground.css as `.nb-card`.
 */
const CardShell: FC<PropsWithChildren<CardShellProps>> = ({ title, meta, busy, updatedAt, onRefresh, compact = false, accent, className = '', children }) => {
    return (
        <div className={`panel nb-card flex h-full flex-col ${compact ? '!p-4' : ''} ${className}`} style={accent ? ({ '--nb-accent-rgb': accent } as CSSProperties) : undefined}>
            <div className={`flex items-start justify-between gap-3 ${compact ? 'mb-3' : 'mb-5'}`}>
                <h5 className={`font-semibold tracking-tight text-white-light ${compact ? 'text-base' : 'text-lg'}`}>{title}</h5>

                <div className="flex flex-none items-center">
                    <RefreshButton section={title} busy={busy} onClick={onRefresh} />
                </div>
            </div>

            {meta && <div className="-mt-3 mb-4 text-xs text-[#8290ad]">{meta}</div>}

            <div className="flex-1">{children}</div>

            <div className={`nb-num text-[11px] text-[#8794b3] ${compact ? 'mt-2.5' : 'mt-4'}`}>
                {busy ? 'Refreshing…' : updatedAt ? `Extracted ${formatDateTime(updatedAt)}` : 'Sample data · not yet extracted'}
            </div>
        </div>
    );
};

export default CardShell;
