# Changelog

All notable changes to RepoAtlas are documented here. Format follows [Keep a Changelog](https://keepachangelog.com/).

## [Unreleased]

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
