import { useCallback, useEffect, useState } from 'react';
import { BriefPayload, sampleBrief } from '../../data/nightBrief';

// Local backend from server/index.mjs — binds 127.0.0.1 only, so this is only
// ever reachable when viewing the dashboard on the same machine that's
// running it. Never touched from anywhere else.
const LOCAL_API = 'http://127.0.0.1:4700';
const PING_TIMEOUT_MS = 3000; // GET is just cached JSON — fail fast if the server's not running.
const REFRESH_TIMEOUT_MS = 45000; // POST runs the real pipeline (fetches + one LLM call).

export type BriefSource = 'local' | 'static' | 'sample';

export interface BriefState {
    data: BriefPayload;
    /** False only for the sample fallback. */
    isLive: boolean;
    /** 'local' = this machine's own backend, on-demand. 'static' = last GitHub Actions run. 'sample' = neither reachable. */
    source: BriefSource;
    loading: boolean;
    reload: () => Promise<void>;
}

async function fetchLocal(path: string, timeoutMs: number, init?: RequestInit): Promise<BriefPayload | null> {
    try {
        const res = await fetch(`${LOCAL_API}${path}`, { ...init, signal: AbortSignal.timeout(timeoutMs) });
        if (!res.ok) return null;
        return (await res.json()) as BriefPayload;
    } catch {
        return null;
    }
}

async function fetchStatic(): Promise<BriefPayload | null> {
    try {
        const res = await fetch('/data/brief.json', { cache: 'no-store' });
        if (!res.ok) return null;
        return (await res.json()) as BriefPayload;
    } catch {
        return null;
    }
}

/**
 * Three-tier source, each covering the one before it: the local backend on
 * this machine (real, on-demand data), the static file GitHub Actions last
 * committed (works from anywhere, once a day), then the sample dashboard —
 * a bad fetch should never blank the page.
 */
export const useBrief = (): BriefState => {
    const [data, setData] = useState<BriefPayload>(sampleBrief);
    const [source, setSource] = useState<BriefSource>('sample');
    const [loading, setLoading] = useState(true);

    const load = useCallback(async () => {
        setLoading(true);

        const local = await fetchLocal('/api/brief', PING_TIMEOUT_MS);
        if (local) {
            setData(local);
            // The local server can be up but only ever have served the
            // committed seed (cold start, never generated) — that's still
            // sample data even though the transport succeeded.
            setSource(local.isSample ? 'sample' : 'local');
            setLoading(false);
            return;
        }

        const fromStatic = await fetchStatic();
        if (fromStatic) {
            setData(fromStatic);
            setSource(fromStatic.isSample ? 'sample' : 'static');
            setLoading(false);
            return;
        }

        setData(sampleBrief);
        setSource('sample');
        setLoading(false);
    }, []);

    // Refresh buttons call this. It tries to trigger a *real* regeneration on
    // the local backend first; only falls back to "check what's already
    // committed" when that's unreachable.
    const reload = useCallback(async () => {
        setLoading(true);

        const refreshed = await fetchLocal('/api/brief/refresh', REFRESH_TIMEOUT_MS, { method: 'POST' });
        if (refreshed) {
            setData(refreshed);
            setSource(refreshed.isSample ? 'sample' : 'local');
            setLoading(false);
            return;
        }

        await load();
    }, [load]);

    useEffect(() => {
        load();
    }, [load]);

    return { data, isLive: source !== 'sample', source, loading, reload };
};
