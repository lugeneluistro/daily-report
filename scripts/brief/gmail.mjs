// Gmail fetching for the email card. Two accounts share one OAuth client
// (registered once in Google Cloud); each account has its own refresh token
// minted via gmail-auth-setup.mjs. No LLM here — this only returns raw
// unread counts and candidate messages for llm.mjs to filter.

const GMAIL_API = 'https://gmail.googleapis.com/gmail/v1/users/me';
const CANDIDATE_LIMIT = 10;

async function getAccessToken(clientId, clientSecret, refreshToken) {
    const res = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            client_id: clientId,
            client_secret: clientSecret,
            refresh_token: refreshToken,
            grant_type: 'refresh_token',
        }),
    });
    if (!res.ok) throw new Error(`token refresh returned ${res.status}`);
    const json = await res.json();
    return json.access_token;
}

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

/** Reads up to two accounts from env: GOOGLE_CLIENT_ID/SECRET are shared,
 * GMAIL_ACCOUNT_{1,2}_LABEL and _REFRESH_TOKEN are per-account. An account
 * with no refresh token set is skipped, not failed. */
export async function fetchGmail() {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

    const configured = [1, 2]
        .map((n) => ({
            label: process.env[`GMAIL_ACCOUNT_${n}_LABEL`] || `Account ${n}`,
            refreshToken: process.env[`GMAIL_ACCOUNT_${n}_REFRESH_TOKEN`],
        }))
        .filter((a) => a.refreshToken);

    if (!clientId || !clientSecret || configured.length === 0) {
        return { ok: false, reason: 'no Gmail accounts configured' };
    }

    const settled = await Promise.allSettled(configured.map((a) => fetchAccount(a.label, clientId, clientSecret, a.refreshToken)));

    const data = [];
    const failed = [];
    settled.forEach((r, i) => {
        if (r.status === 'fulfilled') data.push(r.value);
        else failed.push(`${configured[i].label} (${r.reason.message})`);
    });

    if (data.length === 0) {
        return { ok: false, reason: `all configured accounts failed: ${failed.join('; ')}` };
    }
    return { ok: true, data, partialFailure: failed.length ? failed : null };
}
