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
 * yet" rather than an error. */
export function configuredAccounts() {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const accounts = [1, 2]
        .map((n) => ({
            label: process.env[`GMAIL_ACCOUNT_${n}_LABEL`] || `Account ${n}`,
            refreshToken: process.env[`GMAIL_ACCOUNT_${n}_REFRESH_TOKEN`],
        }))
        .filter((a) => a.refreshToken);

    if (!clientId || !clientSecret || accounts.length === 0) return null;
    return { clientId, clientSecret, accounts };
}
