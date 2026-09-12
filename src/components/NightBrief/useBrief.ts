import { useCallback, useEffect, useState } from 'react';
import { BriefPayload, sampleBrief } from '../../data/nightBrief';

export interface BriefState {
    data: BriefPayload;
    /** False for the sample fallback, or when brief.json could not be read. */
    isLive: boolean;
    loading: boolean;
    reload: () => Promise<void>;
}

/**
 * Fetches the nightly brief written by scripts/brief/run.mjs. Falls back to
 * the sample dashboard on any failure — a bad fetch should never blank the
 * page.
 */
export const useBrief = (): BriefState => {
    const [data, setData] = useState<BriefPayload>(sampleBrief);
    const [isLive, setIsLive] = useState(false);
    const [loading, setLoading] = useState(true);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetch('/data/brief.json', { cache: 'no-store' });
            if (!res.ok) throw new Error(`brief.json responded ${res.status}`);
            const json = (await res.json()) as BriefPayload;
            setData(json);
            setIsLive(!json.isSample);
        } catch {
            setData(sampleBrief);
            setIsLive(false);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        load();
    }, [load]);

    return { data, isLive, loading, reload: load };
};
