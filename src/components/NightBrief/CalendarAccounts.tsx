import { FC } from 'react';
import { CalendarAccountSummary } from '../../data/nightBrief';

interface CalendarAccountsProps {
    accounts: CalendarAccountSummary[];
}

/** One column per Google account: the next few events over roughly the next
 * 36 hours, chronological, with a "Shift" badge on anything inside tonight's
 * 8PM-7AM window. */
const CalendarAccounts: FC<CalendarAccountsProps> = ({ accounts }) => (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        {accounts.map((acct) => (
            <div key={acct.label}>
                <div className="mb-2.5 text-[13px] font-extrabold uppercase tracking-[0.08em] text-[#888ea8]">{acct.label}</div>

                {acct.events.length === 0 ? (
                    <div className="text-xs text-[#5f6b85]">Nothing on the calendar for the next day and a half.</div>
                ) : (
                    <div className="flex flex-col gap-3">
                        {acct.events.map((event) => (
                            <div key={event.id} className="flex items-start gap-3 rounded-md border border-[#1b2e4b] bg-[#101a2d] px-3.5 py-3">
                                <span className="mt-0.5 flex-none whitespace-nowrap text-[12px] font-bold tabular-nums text-[#a8bcff]">{event.startLabel}</span>
                                <div className="min-w-0 flex-1">
                                    <div className="flex items-start justify-between gap-2">
                                        <span className="text-[13.5px] font-bold leading-snug text-white-light">{event.title}</span>
                                        {event.duringShift && (
                                            <span className="flex-none whitespace-nowrap rounded-[3px] bg-primary/[0.16] px-1.5 py-0.5 text-[9.5px] font-extrabold uppercase tracking-[0.1em] text-[#a8bcff]">
                                                Shift
                                            </span>
                                        )}
                                    </div>
                                    {event.location && <div className="mt-0.5 truncate text-xs text-[#888ea8]">{event.location}</div>}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        ))}
    </div>
);

export default CalendarAccounts;
