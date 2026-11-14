import { defineConfig } from "@playwright/test";

import base from "./playwright.config";

// Presentation mode: one visible browser, one test at a time, and each test's final
// screen held for 5 seconds (see the afterEach hook in e2e/disc.spec.ts).
export default defineConfig({
  ...base,
  workers: 1,
  fullyParallel: false,
  timeout: 60_000,
  metadata: { demoPauseMs: 5_000 },
  use: { ...base.use, headless: false },
});
