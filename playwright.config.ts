import { defineConfig, devices } from "@playwright/test";

const PORT = process.env.PLAYWRIGHT_PORT ?? process.env.PORT ?? "3000";
const externalBaseURL = process.env.PLAYWRIGHT_EXTERNAL_URL;
const baseURL = externalBaseURL ?? `http://127.0.0.1:${PORT}`;
const controlledCheckStorageState = {
  cookies: [],
  origins: [
    {
      origin: new URL(baseURL).origin,
      localStorage: [
        { name: "repoatlas-controlled-check", value: "true" },
      ],
    },
  ],
};

const capturePortfolio =
  process.env.CAPTURE_PORTFOLIO === "1" ||
  process.env.npm_lifecycle_event === "capture:portfolio";

// Playwright's web server inherits this process environment on every platform.
process.env.PORT = PORT;
process.env.REPORTS_DIR ??= ".playwright-reports";
// The best-effort in-memory analyze rate limit would otherwise trip across the
// serial e2e suite; disable it for tests (production keeps the default).
process.env.ANALYZE_RATE_LIMIT_PER_MIN ??= "0";
// The production server fails cron cleanup closed without a secret. E2E covers
// the authenticated sweep path by giving the web server and specs the same
// test-only secret; the fail-closed 503 behavior stays covered by unit tests.
process.env.CRON_SECRET ??= "e2e-cron-secret";

export default defineConfig({
  testDir: "./e2e",
  testIgnore: capturePortfolio ? undefined : [/portfolio-capture\.spec\.ts/],
  timeout: 120_000,
  expect: { timeout: 60_000 },
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL,
    storageState: controlledCheckStorageState,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    {
      name: "mobile",
      use: { ...devices["iPhone 13"] },
    },
  ],
  webServer: externalBaseURL
    ? undefined
    : {
        command: "npm run build && npm run start",
        url: baseURL,
        reuseExistingServer: !process.env.CI,
        timeout: 180_000,
      },
});
