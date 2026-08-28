// PM2 process definitions for local development.
//
// `npm run up` (or `just up`) starts these detached via the PM2 daemon, so you
// can close the terminal and the dev servers keep running. `npm run down` stops
// them. Stream output with `npm run logs`.
//
// All apps run from the repo root (cwd) so `npm --prefix` resolves the same way
// on every OS.

const common = {
  script: 'npm',
  watch: false, // ts-node-dev / next dev do their own watching
  autorestart: true,
  restart_delay: 2000,
  min_uptime: 5000,
  max_restarts: 10, // stop hammering if the env is misconfigured (e.g. deps not installed)
  time: true,
};

module.exports = {
  apps: [
    { ...common, name: 'backend', args: '--prefix apps/backend run dev' },
    { ...common, name: 'frontend', args: '--prefix apps/frontend run dev' },
  ],
};
