import { FC } from 'react';
import { BudgetInfo } from '../../data/nightBrief';

interface BudgetOverviewProps {
    budget: BudgetInfo;
}

const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const peso = (n: number) => `₱${n.toLocaleString('en-US', { minimumFractionDigits: Number.isInteger(n) ? 0 : 2, maximumFractionDigits: 2 })}`;
const barColor = (pct: number) => (pct >= 100 ? 'bg-danger' : pct >= 80 ? 'bg-warning' : 'bg-success');
const percent = (spent: number, limit: number) => (limit > 0 ? Math.min(100, Math.round((spent / limit) * 100)) : 0);

/** "2026-10-03" -> "Oct 3" */
const shortDate = (key: string) => `${MONTHS_SHORT[Number(key.slice(5, 7)) - 1] ?? ''} ${Number(key.slice(8, 10))}`;

/** The month against its limits: a total bar, a bar per category, and (for real data) the newest entries. */
const BudgetOverview: FC<BudgetOverviewProps> = ({ budget }) => {
    const totalPct = percent(budget.totalSpent, budget.totalLimit);
    const recent = budget.recent ?? [];

    return (
        <div>
            <div className="mb-1.5 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                <span className="text-[13px] text-[#888ea8]">
                    {budget.monthLabel} &middot; {budget.daysLeftInMonth} days left
                </span>
                <span className="text-[13px] font-bold nb-num text-white-light">
                    {peso(budget.totalSpent)} <span className="text-[#8794b3]">/ {peso(budget.totalLimit)}</span>
                </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-[#1b2e4b]">
                <div className={`h-full rounded-full ${barColor(totalPct)}`} style={{ width: `${totalPct}%` }} />
            </div>

            <div className="mt-5 flex flex-col gap-3.5">
                {budget.categories.map((c) => {
                    const pct = c.limit === null ? 0 : percent(c.spent, c.limit);
                    return (
                        <div key={c.name}>
                            <div className="flex flex-wrap items-baseline justify-between gap-x-3 text-[13px]">
                                <span className="text-[#888ea8]">{c.name}</span>
                                <span className="nb-num text-white-light">
                                    {peso(c.spent)} {c.limit !== null && <span className="text-[#8794b3]">/ {peso(c.limit)}</span>}
                                </span>
                            </div>
                            {/* A category without a limit has nothing to measure against, so no bar. */}
                            {c.limit !== null && (
                                <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-[#1b2e4b]">
                                    <div className={`h-full rounded-full ${barColor(pct)}`} style={{ width: `${pct}%` }} />
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {recent.length > 0 && (
                <div className="mt-4.5 border-t border-[#2a3f63] pt-3">
                    <div className="mb-1.5 text-[10.5px] font-extrabold uppercase tracking-[0.12em] text-[#8794b3]">Latest</div>
                    <ul className="flex flex-col gap-1">
                        {recent.map((e) => (
                            <li key={e.id} className="flex items-baseline gap-2.5 text-[12.5px]">
                                <span className="w-[44px] flex-none nb-num text-[#8794b3]">{shortDate(e.date)}</span>
                                <span className="min-w-0 flex-1 truncate text-[#b7bfd4]">
                                    {e.merchant || e.category}
                                    {e.merchant && <span className="text-[#8794b3]"> &middot; {e.category}</span>}
                                </span>
                                <span className="flex-none nb-num text-white-light">{peso(e.amount)}</span>
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            <div className="mt-4.5 border-t border-[#2a3f63] pt-3.5 text-xs text-[#888ea8]">{budget.note}</div>
        </div>
    );
};

export default BudgetOverview;
