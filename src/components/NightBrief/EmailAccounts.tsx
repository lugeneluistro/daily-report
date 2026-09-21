import { FC } from 'react';
import { EmailAccountSummary } from '../../data/nightBrief';

interface EmailAccountsProps {
    accounts: EmailAccountSummary[];
}

/** "Maria Santos" <maria@x.com> -> Maria Santos; a bare address stays as it is. */
const senderName = (from: string) => {
    const named = from.match(/^\s*"?([^"<]+?)"?\s*<[^>]+>\s*$/);
    return (named ? named[1] : from).trim();
};

/** One block per Gmail account: unread count, then up to five messages the
 * nightly filter judged worth a look — one line each, like the calendar. The
 * AI's one-line reason follows the subject in muted text and is cut off with an
 * ellipsis when the row is narrow; the full sender and reason sit in the tooltip. */
const EmailAccounts: FC<EmailAccountsProps> = ({ accounts }) => (
    <div className="grid grid-cols-1 gap-y-4 sm:grid-cols-2 sm:gap-x-8 xl:grid-cols-1">
        {accounts.map((acct) => (
            <div key={acct.label} className="min-w-0">
                <div className="mb-1 flex items-baseline justify-between gap-3">
                    <span className="min-w-0 truncate text-[12.5px] font-semibold text-[#9aa8c4]">{acct.label}</span>
                    <span className={`flex-none text-[11.5px] font-bold nb-num ${acct.unreadCount > 0 ? 'text-[#a8bcff]' : 'text-[#8794b3]'}`}>{acct.unreadCount} unread</span>
                </div>

                {acct.items.length === 0 ? (
                    <div className="py-1 text-xs text-[#8794b3]">{acct.unreadCount > 0 ? 'Nothing flagged as worth a look.' : 'Inbox zero.'}</div>
                ) : (
                    <div>
                        {acct.items.map((item) => (
                            <div key={item.id} className="flex items-baseline gap-2.5 border-b border-[#2a3f63]/60 py-1.5 last:border-b-0" title={`${item.from}\n${item.summary}`}>
                                <span className="w-[104px] flex-none truncate text-[11.5px] font-bold text-[#a8bcff]">{senderName(item.from)}</span>
                                <span className="min-w-0 flex-1 truncate text-[13px] text-white-light">
                                    {item.subject}
                                    <span className="text-[#96a3c0]"> &middot; {item.summary}</span>
                                </span>
                                {item.important && (
                                    <span className="flex-none whitespace-nowrap rounded-[3px] bg-warning/[0.16] px-1.5 py-px text-[9px] font-extrabold uppercase tracking-[0.1em] text-warning">
                                        Important
                                    </span>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        ))}
    </div>
);

export default EmailAccounts;
