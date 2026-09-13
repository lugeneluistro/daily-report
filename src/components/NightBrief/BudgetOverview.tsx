import { FC } from 'react';
import { BudgetMock } from '../../data/nightBrief';

interface BudgetOverviewProps {
    budget: BudgetMock;
}

const peso = (n: number) => `₱${n.toLocaleString('en-US')}`;
const barColor = (pct: number) => (pct >= 100 ? 'bg-danger' : pct >= 80 ? 'bg-warning' : 'bg-success');

/** Mock UI only — no real budget source is wired up. See mockBudget in data/nightBrief.ts. */
const BudgetOverview: FC<BudgetOverviewProps> = ({ budget }) => {
    const totalPct = Math.min(100, Math.round((budget.totalSpent / budget.totalLimit) * 100));

    return (
        <div>
            <div className="mb-1.5 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                <span className="text-[13px] text-[#888ea8]">
                    {budget.monthLabel} &middot; {budget.daysLeftInMonth} days left
                </span>
                <span className="text-[13px] font-bold tabular-nums text-white-light">
                    {peso(budget.totalSpent)} <span className="text-[#5f6b85]">/ {peso(budget.totalLimit)}</span>
                </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-[#1b2e4b]">
                <div className={`h-full rounded-full ${barColor(totalPct)}`} style={{ width: `${totalPct}%` }} />
            </div>

            <div className="mt-5 flex flex-col gap-3.5">
                {budget.categories.map((c) => {
                    const pct = Math.min(100, Math.round((c.spent / c.limit) * 100));
                    return (
                        <div key={c.name}>
                            <div className="mb-1 flex flex-wrap items-baseline justify-between gap-x-3 text-[13px]">
                                <span className="text-[#888ea8]">{c.name}</span>
                                <span className="tabular-nums text-white-light">
                                    {peso(c.spent)} <span className="text-[#5f6b85]">/ {peso(c.limit)}</span>
                                </span>
                            </div>
                            <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#1b2e4b]">
                                <div className={`h-full rounded-full ${barColor(pct)}`} style={{ width: `${pct}%` }} />
                            </div>
                        </div>
                    );
                })}
            </div>

            <div className="mt-4.5 border-t border-[#1b2e4b] pt-3.5 text-xs text-[#888ea8]">{budget.note}</div>
        </div>
    );
};

export default BudgetOverview;
