import { FC, PropsWithChildren } from 'react';
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
    className?: string;
}

/**
 * The panel every night-brief section sits in: title, a per-card refresh
 * control, and the date/time that section's data was last extracted.
 */
const CardShell: FC<PropsWithChildren<CardShellProps>> = ({ title, meta, busy, updatedAt, onRefresh, className = '', children }) => {
    return (
        <div className={`panel flex h-full flex-col !border !border-[#1b2e4b] ${className}`}>
            <div className="mb-5 flex items-start justify-between gap-3">
                <h5 className="text-lg font-semibold tracking-tight text-white-light">{title}</h5>

                <div className="flex flex-none items-center">
                    <RefreshButton section={title} busy={busy} onClick={onRefresh} />
                </div>
            </div>

            {meta && <div className="-mt-3 mb-4 text-xs text-[#5f6b85]">{meta}</div>}

            <div className="flex-1">{children}</div>

            <div className="mt-4 text-[11px] text-[#4d5871]">{busy ? 'Refreshing…' : updatedAt ? `Extracted ${formatDateTime(updatedAt)}` : 'Sample data · not yet extracted'}</div>
        </div>
    );
};

export default CardShell;
