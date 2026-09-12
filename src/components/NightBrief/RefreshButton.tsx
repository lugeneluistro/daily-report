import { FC } from 'react';
import IconRefresh from '../Icon/IconRefresh';

interface RefreshButtonProps {
    /** Names the section, so the control reads as "Refresh Fuel". */
    section: string;
    busy: boolean;
    onClick: () => void;
    /** Colour classes for the resting and hover states. */
    className?: string;
    /** Optional visible text next to the icon, e.g. "Refresh all". */
    label?: string;
}

const RefreshButton: FC<RefreshButtonProps> = ({
    section,
    busy,
    onClick,
    className = 'border border-[#2a3f63] bg-[#1b2e4b] text-white-light hover:border-primary hover:bg-[#243d63] hover:text-primary',
    label,
}) => (
    <button
        type="button"
        onClick={onClick}
        disabled={busy}
        aria-label={label ? undefined : `Refresh ${section}`}
        aria-busy={busy}
        title={`Refresh ${section}`}
        className={`inline-flex items-center gap-1.5 shadow-sm transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-wait ${
            label ? 'rounded-md' : 'rounded-full p-1.5'
        } ${className}`}
    >
        <IconRefresh className={`h-4 w-4 ${busy ? 'motion-safe:animate-spin' : ''}`} />
        {label && <span>{label}</span>}
    </button>
);

export default RefreshButton;
