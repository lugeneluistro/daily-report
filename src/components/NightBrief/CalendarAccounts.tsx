import { FC } from 'react';
import { CalendarAccountSummary } from '../../data/nightBrief';

interface CalendarAccountsProps {
    accounts: CalendarAccountSummary[];
}

const MAX_PER_ACCOUNT = 5;

/** Compact reminder list, one column per Google account: a single line per
 * event over roughly the next 36 hours, with a "Shift" badge on anything
 * inside tonight's 8PM-7AM window. */
const CalendarAccounts: FC<CalendarAccountsProps> = ({ accounts }) => (
    <div className="grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2">
        {accounts.map((acct) => {
            const shown = acct.events.slice(0, MAX_PER_ACCOUNT);
            const hidden = acct.events.length - shown.length;

            return (
                <div key={acct.label} className="min-w-0">
                    <div className="mb-1 truncate text-[12.5px] font-semibold text-[#9aa8c4]">{acct.label}</div>

                    {shown.length === 0 ? (
                        <div className="py-1 text-xs text-[#8794b3]">Nothing on the calendar for the next day and a half.</div>
                    ) : (
                        <div>
                            {shown.map((event) => (
                                <div key={event.id} className="flex items-baseline gap-2.5 border-b border-[#2a3f63]/60 py-1.5 last:border-b-0">
                                    <span className="w-[128px] flex-none whitespace-nowrap text-[11.5px] font-bold nb-num text-[#a8bcff]">{event.startLabel}</span>
                                    <span className="min-w-0 flex-1 truncate text-[13px] text-white-light">
                                        {event.title}
                                        {event.location && <span className="text-[#8794b3]"> &middot; {event.location}</span>}
                                    </span>
                                    {event.duringShift && (
                                        <span className="flex-none whitespace-nowrap rounded-[3px] bg-primary/[0.16] px-1.5 py-px text-[9px] font-extrabold uppercase tracking-[0.1em] text-[#a8bcff]">
                                            Shift
                                        </span>
                                    )}
                                </div>
                            ))}
                            {hidden > 0 && <div className="pt-1 text-[11px] text-[#8794b3]">+{hidden} more</div>}
                        </div>
                    )}
                </div>
            );
        })}
    </div>
);

export default CalendarAccounts;
