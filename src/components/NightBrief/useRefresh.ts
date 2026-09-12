import { useCallback, useEffect, useRef, useState } from 'react';

/** How long the spinner holds when there is nothing real to wait on. */
const MIN_SPIN_MS = 700;

export interface RefreshState {
    busy: boolean;
    refresh: () => void;
}

/**
 * Drives a card's refresh control.
 *
 * Pass `onRefresh` to reload the section. Return a promise from it and the
 * spinner runs until that promise settles; return nothing and it holds briefly
 * so the click is visible.
 *
 * This only tracks the in-flight spinner — the "last extracted" timestamp
 * shown on the card comes from the brief payload's own `generatedAt`, not
 * from when the browser happened to fetch it.
 */
export const useRefresh = (onRefresh?: () => void | Promise<void>): RefreshState => {
    const [busy, setBusy] = useState(false);
    const timer = useRef<number>();
    const alive = useRef(true);

    useEffect(() => {
        alive.current = true;
        return () => {
            alive.current = false;
            window.clearTimeout(timer.current);
        };
    }, []);

    const settle = useCallback(() => {
        if (!alive.current) return;
        setBusy(false);
    }, []);

    const refresh = useCallback(() => {
        if (busy) return;
        setBusy(true);

        const result = onRefresh?.();

        if (result && typeof (result as Promise<void>).then === 'function') {
            (result as Promise<void>).then(settle, settle);
            return;
        }

        timer.current = window.setTimeout(settle, MIN_SPIN_MS);
    }, [busy, onRefresh, settle]);

    return { busy, refresh };
};

/** Date + time, used wherever we show when data was last extracted. */
export const formatDateTime = (d: Date) => d.toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
