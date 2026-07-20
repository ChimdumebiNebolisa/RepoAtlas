# Changelog

All notable changes to RepoAtlas are documented here. Format follows [Keep a Changelog](https://keepachangelog.com/).

## [Unreleased]

## [2026-07-20] — Operational reliability

### Reliability

- Storage fallbacks, partial analysis timeouts, and export failures now emit structured diagnostics with allowlisted fields only; report identifiers, repository details, and raw server messages stay out of logs and analytics.
- Four previously timing-sensitive mobile recovery and sharing journeys now synchronize with the hydrated page state and pass their first-attempt regression runs without retries.

### Documentation

- The README and engineering specification now describe saved and inline reports, persistence-aware API responses, PDF and PNG availability, storage-dependent Markdown export, and both private sharing paths as they work today.

## [2026-07-18] — Candidate Brief workflow and resilience

### Customer-visible behavior

- The start flow now leads with the bundled sample and public GitHub URL, with ZIP upload as a secondary input, and supports interview walkthrough, bug investigation, planned-change, and pull-request discussion intents.
- Completed analyses return the full report inline when report storage is unavailable instead of failing after analysis. Responses state whether persistence succeeded so the interface enables only supported actions.
- Completed briefs now offer one private share action. Saved reports use server-backed links; inline reports use an encrypted, browser-only link with a seven-day expiry.
- PDF and PNG exports now render large briefs within bounded browser memory and have file-level integrity coverage. Inline reports explain that Markdown export requires saved report storage.
- The homepage now includes factual repository-handling answers, and Privacy, Terms, and Contact pages are reachable from a consistent footer.

### Reliability

- Repository failures now return bounded recovery states for rate limits, analysis timeouts, oversized archives, private or missing repositories, and invalid refs without logging repository details.
- Vercel Blob persistence accepts static tokens, environment OIDC, and request-scoped OIDC credentials when a store is connected, while preserving the inline fallback when storage is not available.
- Production-like Python and Java upload coverage now checks language-specific graphs, entry points, commands, and confidence notes. Java test classes are excluded from application entry-point detection.
- Production builds now fail if broad report server-file tracing returns or if an unexpected traced file is packaged.

### Accessibility

- All eight report sections now follow the horizontal tab keyboard pattern with Arrow, Home, and End activation, one tab stop, and linked focus-visible panels.
- Invalid ZIP, missing-report, and expired-share states announce failures to assistive technology and expose keyboard-reachable recovery actions.
- The homepage brand link now uses its visible label as its accessible name. Production Lighthouse checks pass Accessibility, Best Practices, SEO, and Agentic Browsing audits.

### Performance

- The ELK architecture engine now loads only when the Architecture Map or an export needs it. Initial JavaScript across the homepage, completed-report, and shared-report journeys fell by about 67%, with route-specific build budgets preventing silent growth.

### Privacy

- Product analytics records a bounded activation funnel while excluding repository URLs, filenames, report identifiers, share tokens, report contents, autocapture, session recordings, and exception capture.

### Security

- Archive handling now uses `adm-zip` 0.6.0, and both production-only and full dependency audits report no known vulnerabilities.

## [2026-07-17] — Platform and archive hardening

### Security

- ZIP extraction now rejects duplicate normalized destinations and file/child path conflicts before writing any archive content.
- Production pages now send a tested Content Security Policy with same-origin execution and connectivity, frame and object restrictions, and only the data and blob capabilities required for report export.
- Production and full dependency audits now run on pull requests, main pushes, a weekly schedule, and manual dispatch, failing on low-or-higher vulnerabilities.

### Reliability

- The application moved to Next.js 16 and Node.js 20.9 or newer, with its lint, type, build, report, and sharing behavior updated for the supported framework line.

## [2026-07-13] — Semantic architecture analysis

### Added

- TypeScript and JavaScript analysis now uses the TypeScript compiler API to resolve relative imports, path aliases, package exports, and workspace packages instead of inferring dependencies with regular expressions.
- Reports now preserve internal, external, and unresolved semantic edges with bounded source evidence. Architecture coupling and Danger Zone fan-in and fan-out use resolved internal edges only.
- TypeScript and JavaScript structural complexity now comes from parsed decision points, nesting, and lines of code, and entry-point detection covers Next.js routes plus package and script declarations with explicit reasons.

## [2026-07-10] — Stabilization pass

### Added

- `npm run typecheck` and `npm run test:coverage` with CI gates; coverage thresholds in `vitest.config.ts`.
- Deployment-honest ZIP limits: **4 MB** multipart cap on Vercel, **100 MB** locally; GitHub URL mode for larger public repos (`src/lib/ingestLimits.ts`, `src/lib/ingestLimitsClient.ts`).
- Runtime validation for stored report JSON (`src/lib/reportSchema.ts`) — corrupt or incompatible payloads are treated as not found.
- Cron cleanup **fail-closed** in production when `CRON_SECRET` is unset (`src/app/api/cron/cleanup/route.ts`).
- Blob parity for share-token listing, deletion, and TTL sweep (`src/lib/sharing.ts`).
- Architecture Decision Records under `docs/adr/`.

### Changed

- Non-breaking security-dependency upgrades (jsPDF critical, undici/lodash-es high, dompurify/uuid moderate).
- Analyzer correctness: Python `from . import x` resolution, nested test-directory detection, Danger Zones exclude test files, honest test-proximity copy, removal of noisy per-language warnings and a self-referential interview question.
- Report and export responses use `Cache-Control: no-store` plus baseline security headers via `next.config.js`.
- Honest report source/date rendering in the UI.
- Node.js engine requirement raised to **>= 20** (`package.json`).

### Removed

- Public `DELETE /api/reports/:id` — retention is server-side TTL sweep only; report ids are read-only capabilities with no ownership model.
- Caller-controlled JSON `zipRef` on `POST /api/analyze` — rejected with `400 INVALID_INPUT`.
- Server-owned `GITHUB_TOKEN` attachment to user-supplied repository requests — public GitHub ingestion remains unauthenticated.

### Security

- Capability-link access model documented in [SECURITY.md](SECURITY.md) and [docs/adr/001-capability-access.md](docs/adr/001-capability-access.md).
- ZIP extraction limits and deployment caps documented in [docs/adr/002-zip-limits.md](docs/adr/002-zip-limits.md).
