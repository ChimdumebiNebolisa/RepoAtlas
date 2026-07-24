# Changelog

All notable changes to RepoAtlas are documented here. Format follows [Keep a Changelog](https://keepachangelog.com/).

## [Unreleased]

## [2026-07-24] - Walkthrough text integrity

### Candidate Brief

- Long README purposes now stop at complete words, grapheme clusters, and inline Markdown boundaries in the 30-second, 2-minute, and system-flow walkthroughs.
- Purpose excerpts preserve valid links with nested destination parentheses and retain a single terminal mark without changing the full extracted purpose or its evidence.
- Starting a new analysis removes the previous Candidate Brief before loading, so a failed retry cannot leave stale evidence or saved-report guidance on screen.

### Reliability

- Analysis-rate-limit startup keeps the first configured process-wide limiter instead of replacing a healthy limiter after a startup-module reload.
- The interview-preparation start link preserves accepted bounded source values, discards unrecognized values, and continues to open the analysis form.

## [2026-07-23] - Evidence integrity and sparse-report recovery

### Candidate Brief

- Sparse Architecture Maps now show the exact zero-node and zero-edge result, explain that missing dependency evidence does not prove missing architecture, and direct readers to Folder Map, Start Here, and confidence notes.
- Long evidence paths, run commands, and source locations now wrap inside narrow report panels.
- Evidence cards preserve generated relationship, warning, and manifest context. Repository summaries and interview questions use repository-specific claims only when the report contains direct evidence for them.
- New reports and delivery variants open a clean Candidate Brief workspace instead of inheriting the previous report's selected panel or export and sharing feedback.

### Security and reliability

- Evidence snippet reads reject absolute paths, traversal, symlink escapes, secret-like names, unreadable files, and invalid line bounds before reading.
- Repository indexing skips unreadable or unsafe nested entries while preserving deterministic ordering and preventing traversal outside the workspace.
- Shared report loaders, stored share records, portable links, cached analyses, and current-version report data fail closed when records are malformed, incomplete, expired, future-dated, or incompatible.
- Product analytics now applies event-specific property allowlists before capture, including the bounded `report_viewed` and `walkthrough_copied` signals.
- Commit-history signals remain scoped to the analyzed revision, and equal churn counts use a stable path tie-break.

## [2026-07-22] - Analysis and report hardening

### Analysis

- Production ZIP extraction streams from disk through `yauzl`, enforces path and size limits before writing, and closes archive handles on success and failure.
- Analysis runs in an isolated `worker_threads` host. Only recognized startup failures before the ready handshake may fall back in-process; aborts, deadlines, worker exits, and post-start failures stop without silently rerunning the repository.
- TypeScript entry-point detection now resolves nested package targets and valid Next.js App Router route handlers while excluding test files.
- Python import scanning handles parenthesized and continued statements, and Java analysis resolves safe same-package and static-import references without treating test-tree classes as application entry points.
- Run-command extraction now handles alternate package, Python, Compose, shell-fence, Pipenv, Poetry, Maven, and Gradle forms without inventing commands from malformed metadata.
- Start Here maps equal raw scores to a neutral value, and Danger Zone percentiles shrink toward the absolute scale for very small repositories.

### Platform

- Optional Upstash Redis REST rate limiting provides a distributed path when configured. Endpoints must use HTTPS under `upstash.io`, and malformed store responses use the explicit best-effort fallback instead of being reported as a healthy distributed check.
- Same-commit GitHub cache entries are scoped by analysis intent and report version and reject expired, future-dated, mismatched, malformed, or partial records.
- Runtime report validation now checks the complete current Candidate Brief shape, finite numeric values, bounded folder depth, and semantic and evidence fields before saved or shared data reaches the interface.
- Multipart ZIP writes stop when the request is aborted. Report action feedback remains truthful while availability is loading or an export or share fails, and current form values survive hydration and fast submission.

## [2026-07-21] - Candidate-first walkthrough

### Customer-visible behavior

- The homepage now follows one five-section proof path, keeps interview walkthrough as the primary intent, and uses the bundled sample as the single prominent starting action.
- Completed reports appear immediately after analysis instead of below the marketing page. Public GitHub and ZIP submissions read the current form values even on fast submission.
- The sample preview now derives its repository summary, walkthrough, reading path, architecture explanation, interviewer question, and evidence references from the same analysis as the full sample report.
- The interview-preparation page and homepage now make the same supported-language, evidence, storage, export, and sharing promises.

### Reliability and measurement

- Report navigation, export, sharing, and walkthrough state are separated into focused boundaries while preserving the established report order and delivery behavior.
- Product analytics now records one bounded `report_viewed` signal and a confirmed `walkthrough_copied` signal for the 30-second or 2-minute format without repository content, URLs, paths, or report identifiers.
- The complete mobile sharing matrix returns first-attempt results without retries, including repeated native WebKit sharing.

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
