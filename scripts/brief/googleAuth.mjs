// Shared OAuth plumbing for Google APIs. Gmail and Calendar both read from
// the same two accounts — one shared OAuth client, one refresh token per
// account, minted once via google-auth-setup.mjs.

export async function getAccessToken(clientId, clientSecret, refreshToken) {
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

/** Reads the shared client + up to two accounts from env. Returns null when
 * nothing is configured, so callers can treat that as "feature not set up
 * yet" rather than an error.
 *
 * `label` is only set when GMAIL_ACCOUNT_n_LABEL overrides the default; the
 * card otherwise shows the account's real email address (see
 * resolveAccountLabel). `fallbackLabel` is used if that lookup fails. */
export function configuredAccounts() {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const accounts = [1, 2]
        .map((n) => ({
            label: process.env[`GMAIL_ACCOUNT_${n}_LABEL`] || null,
            fallbackLabel: `Account ${n}`,
            refreshToken: process.env[`GMAIL_ACCOUNT_${n}_REFRESH_TOKEN`],
        }))
        .filter((a) => a.refreshToken);

    if (!clientId || !clientSecret || accounts.length === 0) return null;
    return { clientId, clientSecret, accounts };
}

/** What to call an account on the dashboard: an explicit label override, else
 * the account's real email address (the gmail.readonly scope we already hold
 * covers the profile lookup), else "Account n". Never throws. */
export async function resolveAccountLabel(account, accessToken) {
    if (account.label) return account.label;
    try {
        const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/profile', { headers: { Authorization: `Bearer ${accessToken}` } });
        if (res.ok) return (await res.json()).emailAddress ?? account.fallbackLabel;
    } catch {
        // fall through to the generic label
    }
    return account.fallbackLabel;
}
