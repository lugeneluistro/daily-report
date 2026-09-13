// PM2 process definition for the local night-brief backend.
//
// Setup (run once):
//   npm install -g pm2 pm2-windows-startup
//   pm2-startup install
//
// Start (from this directory, with ANTHROPIC_API_KEY / GOOGLE_* / GMAIL_*
// already set in your shell or user environment variables — pm2 inherits
// whatever env it's started with):
//   pm2 start ecosystem.config.cjs
//   pm2 save
//
// pm2 save + pm2-startup install together mean PM2 resurrects this process
// automatically on Windows boot, even if nobody logs in. It does NOT survive
// sleep — see the note in the project chat about wake timers if the 5PM
// schedule needs to fire even while the PC would otherwise be asleep.

module.exports = {
    apps: [
        {
            name: 'night-brief-server',
            script: 'server/index.mjs',
            cwd: __dirname,
            autorestart: true,
            watch: false,
        },
    ],
};
