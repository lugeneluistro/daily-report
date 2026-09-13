// Gmail fetching for the email card. No LLM here — this only returns raw
// unread counts and candidate messages for llm.mjs to filter.

import { getAccessToken, configuredAccounts } from './googleAuth.mjs';

const GMAIL_API = 'https://gmail.googleapis.com/gmail/v1/users/me';
const CANDIDATE_LIMIT = 10;

async function gmailGet(path, accessToken) {
    const res = await fetch(`${GMAIL_API}${path}`, { headers: { Authorization: `Bearer ${accessToken}` } });
    if (!res.ok) throw new Error(`Gmail API ${path} returned ${res.status}`);
    return res.json();
}

const headerValue = (headers, name) => headers.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value ?? null;

async function fetchAccount(label, clientId, clientSecret, refreshToken) {
    const accessToken = await getAccessToken(clientId, clientSecret, refreshToken);

    const [unreadLabel, list] = await Promise.all([
        gmailGet('/labels/UNREAD', accessToken),
        gmailGet(`/messages?q=is:unread&maxResults=${CANDIDATE_LIMIT}`, accessToken),
    ]);

    const messageIds = (list.messages ?? []).map((m) => m.id);
    const candidates = await Promise.all(
        messageIds.map(async (id) => {
            const msg = await gmailGet(`/messages/${id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date`, accessToken);
            const headers = msg.payload?.headers ?? [];
            return {
                id: msg.id,
                from: headerValue(headers, 'From') ?? 'Unknown sender',
                subject: headerValue(headers, 'Subject') ?? '(no subject)',
                snippet: msg.snippet ?? '',
                receivedAt: headerValue(headers, 'Date'),
            };
        }),
    );

    return {
        label,
        unreadCount: unreadLabel.messagesUnread ?? messageIds.length,
        candidates,
    };
}

/** An account with no refresh token set is skipped, not failed. */
export async function fetchGmail() {
    const config = configuredAccounts();
    if (!config) return { ok: false, reason: 'no Gmail accounts configured' };

    const settled = await Promise.allSettled(config.accounts.map((a) => fetchAccount(a.label, config.clientId, config.clientSecret, a.refreshToken)));

    const data = [];
    const failed = [];
    settled.forEach((r, i) => {
        if (r.status === 'fulfilled') data.push(r.value);
        else failed.push(`${config.accounts[i].label} (${r.reason.message})`);
    });

    if (data.length === 0) {
        return { ok: false, reason: `all configured accounts failed: ${failed.join('; ')}` };
    }
    return { ok: true, data, partialFailure: failed.length ? failed : null };
}
