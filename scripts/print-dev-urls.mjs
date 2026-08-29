// Print the local dev server URLs after `npm run up` / `just up`.
// Cross-platform (plain Node stdout) so the output is identical on
// macOS, Linux, and Windows. Ports mirror the dev server defaults and
// honour the same PORT env overrides the servers themselves read.

const frontendPort = process.env.FRONTEND_PORT || process.env.PORT || "3000";
const backendPort = process.env.BACKEND_PORT || "8000";

process.stdout.write(
  [
    "",
    "Dev servers running (PM2):",
    `  Frontend: http://localhost:${frontendPort}`,
    `  Backend:  http://localhost:${backendPort}`,
    "",
    "  just logs    stream output      just down    stop",
    "",
  ].join("\n") + "\n"
);
