# RepoAtlas

RepoAtlas is a single Next.js 16 (App Router) + React 19 + TypeScript app that performs deterministic, no-AI static analysis of an uploaded repository zip and produces a "Candidate Brief". See `README.md` for the full product overview, API reference, and standard commands.

## Cursor Cloud specific instructions

This is a single web service (Next.js). Standard commands live in `package.json` scripts and `README.md` (`npm run dev`, `npm run build`, `npm run start`, `npm run lint`, `npm test`, `npm run test:e2e`); use those directly rather than duplicating them here.

Non-obvious caveats:

- **e2e vs. a running dev server:** `playwright.config.ts` uses `reuseExistingServer: !CI`, so if `npm run dev` is already running on port 3000, `npm run test:e2e` reuses that dev server instead of starting its own build+start server. The reused dev server uses the default `REPORTS_DIR` (`reports/`) rather than the test's `.playwright-reports`, which makes the share/report-persistence tests fail. When a dev server is up, run e2e on an isolated port so Playwright starts its own server: `PLAYWRIGHT_PORT=3100 npm run test:e2e`.
- **e2e state contamination:** e2e report/share state is written to `.playwright-reports/` (gitignored). Stale files there can make "missing report" tests pass unexpected reports (e.g. GET/DELETE returning 200/204 instead of 404). If e2e fails unexpectedly, delete `.playwright-reports/` and `test-results/` before rerunning.
- **Playwright browsers:** e2e needs the Chromium browser installed via `npx playwright install --with-deps chromium` (handled by the startup update script).
- **No secrets required for local dev:** report storage defaults to the local filesystem (`reports/`). `BLOB_READ_WRITE_TOKEN`, `CRON_SECRET`, and `GITHUB_TOKEN` are all optional.
- **Core workflow to smoke-test:** upload a zip via the UI, or click "Try sample Candidate Brief" on the homepage, or POST a fixture path: `curl -X POST http://localhost:3000/api/analyze -H "Content-Type: application/json" -d '{"zipRef":"fixtures/repo-ts"}'` then `GET /api/reports/<id>`.
