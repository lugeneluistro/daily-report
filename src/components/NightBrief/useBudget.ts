import { useCallback, useEffect, useState } from 'react';
import { BudgetInfo, mockBudget } from '../../data/nightBrief';
import { LOCAL_API } from './useBrief';

const PING_TIMEOUT_MS = 3000;

/**
 * live            real spending from the Telegram expense log
 * not-configured  the backend is up but has no TELEGRAM_BOT_TOKEN
 * outdated        a backend that predates /api/budget — it needs a restart
 * unreachable     no backend running
 * All but the first show the sample figures, labelled as such.
 */
export type BudgetStatus = 'live' | 'not-configured' | 'outdated' | 'unreachable';

export interface BudgetState {
    budget: BudgetInfo;
    status: BudgetStatus;
    reload: () => Promise<void>;
}

const looksLikeBudget = (b: BudgetInfo | undefined): b is BudgetInfo => typeof b?.totalSpent === 'number' && typeof b.totalLimit === 'number' && Array.isArray(b.categories);

/**
 * The Budget card's own data, kept apart from the nightly brief: it comes from
 * the local backend's expense ledger on every load, costs no model call, and is
 * never written to brief.json (which git tracks). Refreshing just re-reads it.
 */
export const useBudget = (): BudgetState => {
    const [state, setState] = useState<Omit<BudgetState, 'reload'>>({ budget: mockBudget, status: 'unreachable' });

    const reload = useCallback(async () => {
        try {
            const res = await fetch(`${LOCAL_API}/api/budget`, { signal: AbortSignal.timeout(PING_TIMEOUT_MS) });
            if (res.status === 404) {
                setState({ budget: mockBudget, status: 'outdated' });
                return;
            }
            if (!res.ok) throw new Error(String(res.status));
            const json = (await res.json()) as { configured: boolean; budget?: BudgetInfo };

            if (json.configured && looksLikeBudget(json.budget)) setState({ budget: json.budget, status: 'live' });
            else setState({ budget: mockBudget, status: json.configured ? 'unreachable' : 'not-configured' });
        } catch {
            setState({ budget: mockBudget, status: 'unreachable' });
        }
    }, []);

    useEffect(() => {
        reload();
    }, [reload]);

    return { ...state, reload };
};
