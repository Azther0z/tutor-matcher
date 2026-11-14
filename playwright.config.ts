import { defineConfig, devices } from "@playwright/test";

// Black-box DISC suite. It drives a running stack (`just up`) and the fixtures from
// `npm --prefix apps/backend run seed:e2e`; it does not start the servers itself.
export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  expect: { timeout: 7_000 },
  fullyParallel: true,
  retries: 0,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000",
    trace: "retain-on-failure",
    // E2E_SCREENSHOTS=1 keeps a final-state screenshot of every test for the test-plan document.
    screenshot: process.env.E2E_SCREENSHOTS ? { mode: "on", fullPage: true } : "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
