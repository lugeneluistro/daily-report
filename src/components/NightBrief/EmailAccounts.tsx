import { FC } from 'react';
import { EmailAccountSummary } from '../../data/nightBrief';

interface EmailAccountsProps {
    accounts: EmailAccountSummary[];
}

/** One column per Gmail account: unread count, then up to five messages the
 * nightly filter judged worth a look. */
const EmailAccounts: FC<EmailAccountsProps> = ({ accounts }) => (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        {accounts.map((acct) => (
            <div key={acct.label}>
                <div className="mb-2.5 flex items-center justify-between">
                    <span className="text-[13px] font-extrabold uppercase tracking-[0.08em] text-[#888ea8]">{acct.label}</span>
                    <span className={`text-xs font-bold tabular-nums ${acct.unreadCount > 0 ? 'text-[#a8bcff]' : 'text-[#5f6b85]'}`}>{acct.unreadCount} unread</span>
                </div>

                {acct.items.length === 0 ? (
                    <div className="text-xs text-[#5f6b85]">{acct.unreadCount > 0 ? 'Nothing flagged as worth a look.' : 'Inbox zero.'}</div>
                ) : (
                    <div className="flex flex-col gap-3">
                        {acct.items.map((item) => (
                            <div key={item.id} className="rounded-md border border-[#1b2e4b] bg-[#101a2d] px-3.5 py-3">
                                <div className="flex items-start justify-between gap-2">
                                    <span className="text-[13.5px] font-bold leading-snug text-white-light">{item.subject}</span>
                                    {item.important && (
                                        <span className="flex-none whitespace-nowrap rounded-[3px] bg-warning/[0.14] px-1.5 py-0.5 text-[9.5px] font-extrabold uppercase tracking-[0.1em] text-warning">
                                            Important
                                        </span>
                                    )}
                                </div>
                                <div className="mt-0.5 truncate text-xs text-[#888ea8]">{item.from}</div>
                                <div className="mt-1 text-[13px] leading-relaxed text-[#b7bfd4]">{item.summary}</div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        ))}
    </div>
);

export default EmailAccounts;
