// PM2 process definition for the local night-brief backend.
//
// Setup (run once):
//   npm install -g pm2 pm2-windows-startup
//   pm2-startup install
//
// Start (from this directory, with ANTHROPIC_API_KEY — and the optional
// OPENAI_* / AWS_* / CALLMEBOT_* keys — already set as Windows *User*
// environment variables — pm2 inherits whatever env it was started with):
//   pm2 start ecosystem.config.cjs
//   pm2 save
//
// After you change a key, open a NEW terminal (restart VS Code first — its
// terminals keep the old environment) and run:
//   pm2 restart night-brief-server --update-env
//
// pm2 save + pm2-startup install mean PM2 resurrects this process when you log
// in to Windows (pm2-windows-startup registers a per-user startup entry, so it
// runs at login, not before it). It does NOT survive sleep — see the note in
// the project chat about wake timers if the 5PM schedule needs to fire even
// while the PC would otherwise be asleep.

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
