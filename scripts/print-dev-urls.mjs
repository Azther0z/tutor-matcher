// Print the local dev server URLs after `npm run up` / `just up`.
// Cross-platform (plain Node stdout) so the output is identical on
// macOS, Linux, and Windows. Ports mirror the host mappings in the root
// Compose file.

const frontendPort = "3000";
const backendPort = "8000";

process.stdout.write(
  [
    "",
    "Local Compose services running:",
    `  Frontend: http://localhost:${frontendPort}`,
    `  Backend:  http://localhost:${backendPort}`,
    "",
    "  just logs    stream output      just down    stop",
    "",
  ].join("\n") + "\n"
);
