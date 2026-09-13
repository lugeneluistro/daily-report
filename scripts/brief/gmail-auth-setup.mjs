// One-time local helper: run this once per Gmail account to mint a refresh
// token, then save it as a GitHub secret. Never runs in CI.
//
// Setup (once): in Google Cloud Console, create a project, enable the
// Gmail API, and create an OAuth client of type "Desktop app". Copy its
// client ID and secret.
//
// Usage (run twice, once per account, logging into a different Google
// account each time when the browser tab opens):
//   GOOGLE_CLIENT_ID=... GOOGLE_CLIENT_SECRET=... node scripts/brief/gmail-auth-setup.mjs
//
// A Desktop-app OAuth client doesn't require pre-registering the redirect
// URI — Google allows any loopback port for this client type.

import http from 'node:http';
import { URL } from 'node:url';

const clientId = process.env.GOOGLE_CLIENT_ID;
const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

if (!clientId || !clientSecret) {
    console.error('Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET first.');
    process.exit(1);
}

const server = http.createServer();
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const port = server.address().port;
const redirectUri = `http://127.0.0.1:${port}`;

const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
authUrl.searchParams.set('client_id', clientId);
authUrl.searchParams.set('redirect_uri', redirectUri);
authUrl.searchParams.set('response_type', 'code');
authUrl.searchParams.set('scope', 'https://www.googleapis.com/auth/gmail.readonly');
authUrl.searchParams.set('access_type', 'offline');
authUrl.searchParams.set('prompt', 'consent'); // forces a refresh_token even on repeat runs

console.log('\nOpen this URL, sign in with the Gmail account you want to add, and approve access:\n');
console.log(authUrl.toString());
console.log('\nWaiting for the browser redirect...\n');

const code = await new Promise((resolve, reject) => {
    server.on('request', (req, res) => {
        const url = new URL(req.url, redirectUri);
        const code = url.searchParams.get('code');
        const error = url.searchParams.get('error');

        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(error ? `<h1>Failed: ${error}</h1>You can close this tab.` : '<h1>Success</h1>You can close this tab and return to the terminal.');

        if (error) reject(new Error(error));
        else resolve(code);
    });
});
server.close();

const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
    }),
});

if (!tokenRes.ok) {
    console.error(`Token exchange failed: ${tokenRes.status} ${await tokenRes.text()}`);
    process.exit(1);
}

const tokens = await tokenRes.json();

if (!tokens.refresh_token) {
    console.error(
        '\nNo refresh_token in the response. If you\'ve run this before for the same account, Google may skip issuing a new one — ' +
            'revoke the app\'s access at https://myaccount.google.com/permissions and run this again.',
    );
    process.exit(1);
}

console.log('\nSave this as a GitHub Actions secret (GMAIL_ACCOUNT_1_REFRESH_TOKEN or GMAIL_ACCOUNT_2_REFRESH_TOKEN):\n');
console.log(tokens.refresh_token);
console.log('\nAlso set a matching GMAIL_ACCOUNT_{1,2}_LABEL secret (e.g. "Personal" or "Work") so the card knows which account is which.\n');
