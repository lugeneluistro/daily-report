import { FC } from 'react';
import { ClaimekBillingInfo } from '../../data/nightBrief';

interface ClaimekBillingProps {
    billing: ClaimekBillingInfo;
}

const usd = (n: number) => `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const PROVIDER_ACCENT: Record<string, string> = {
    OpenAI: 'text-[#4ade9b]',
    AWS: 'text-[#e2a03f]',
};

/** One column per billing provider: month-to-date total, then the top spend
 * line items (OpenAI: line_item; AWS: service), highest first. */
const ClaimekBilling: FC<ClaimekBillingProps> = ({ billing }) => {
    const combinedTotal = billing.providers.reduce((sum, p) => sum + p.monthToDateUsd, 0);

    return (
        <div>
            <div className="mb-3 flex items-baseline justify-between border-b border-[#2a3f63] pb-2.5">
                <span className="text-[13px] text-[#888ea8]">{billing.monthLabel} &middot; month to date</span>
                <span className="text-[19px] font-extrabold nb-num text-white-light">{usd(combinedTotal)}</span>
            </div>

            <div className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
                {billing.providers.map((p) => (
                    <div key={p.provider}>
                        <div className="mb-2 flex items-baseline justify-between">
                            <span className={`text-[13px] font-extrabold uppercase tracking-[0.08em] ${PROVIDER_ACCENT[p.provider] ?? 'text-[#888ea8]'}`}>{p.provider}</span>
                            <span className="text-[15px] font-bold nb-num text-white-light">{usd(p.monthToDateUsd)}</span>
                        </div>

                        {p.topItems.length === 0 ? (
                            <div className="text-xs text-[#8794b3]">No line items yet this month.</div>
                        ) : (
                            <div className="flex flex-col gap-1.5">
                                {p.topItems.map((item) => {
                                    const pct = p.monthToDateUsd > 0 ? Math.round((item.amount / p.monthToDateUsd) * 100) : 0;
                                    return (
                                        <div key={item.name}>
                                            <div className="mb-0.5 flex items-baseline justify-between text-[12.5px]">
                                                <span className="truncate text-[#888ea8]">{item.name}</span>
                                                <span className="flex-none nb-num text-white-light">{usd(item.amount)}</span>
                                            </div>
                                            <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#1b2e4b]">
                                                <div className="h-full rounded-full bg-primary/70" style={{ width: `${pct}%` }} />
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
};

export default ClaimekBilling;
