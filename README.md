# RepoAtlas

**Deterministic, no-AI repository analysis** — upload a repo zip or paste a **public GitHub URL** and get an evidence-backed **Candidate Brief** for interviews, take-homes, onboarding, and open-source contribution prep.

RepoAtlas reads repository files as text only (never executes them) and produces:

- **Candidate Brief** (primary tab): reading path, interview talking points, first PR ideas, resume bullets, walkthrough script, and evidence index
- Folder Map: recursive directory tree
- Architecture Map: interactive ELK-based dependency graph with pan and zoom
- Start Here: ranked reading path with signal-based explanations
- Danger Zones: risk-ranked hotspots with metric breakdowns (including churn when git metadata is present)
- Run and Contribute: extracted run commands from package.json, Makefile, Docker, README, and more
- Export: full report as PDF, PNG, or Markdown (`repoatlas-candidate-brief-{repo}-{date}.md`)

Deep analysis is currently implemented for TypeScript/JavaScript, Python, and Java repositories.

Two input modes are supported through the web UI:

- **Upload ZIP** — best for local snapshots; up to **100 MB** compressed locally, **4 MB** on Vercel (platform body limit). Use GitHub URL mode for larger public repos when deployed.
- **Public GitHub URL** — canonical `https://github.com/owner/repo` with optional branch/tag ref; server streams the public archive (up to 100 MB compressed).

RepoAtlas extracts or downloads the archive, analyzes the repository, stores the report, and returns a report ID (read-only capability) that the UI can load or export.

---

## Table of Contents

- [Features](#features)
- [How It Works](#how-it-works)
- [Architecture](#architecture)
- [Tech Stack](#tech-stack)
- [Requirements](#requirements)
- [Quick Start](#quick-start)
- [Screenshots](#screenshots)
- [Example Candidate Brief](#example-candidate-brief)
- [Usage](#usage)
- [API Reference](#api-reference)
- [Configuration](#configuration)
- [Project Structure](#project-structure)
- [Development](#development)
- [Testing](#testing)
- [Fixtures](#fixtures)
- [Limits and Behavior](#limits-and-behavior)
- [Security Notes](#security-notes)
- [Libraries and Licenses](#libraries-and-licenses)
- [License](#license)

---

## Features

- Dual input: upload a zip **or** paste a public GitHub URL (or try the sample Candidate Brief)
- Deterministic scoring: Start Here and Danger Zones are derived from measurable repo signals — no LLM calls
- Multi-language packs: TS/JS, Python, and Java packs provide deeper static analysis
- Interactive visualization: pan and zoom dependency view with ELK layout
- Portable exports:
  - Client-side full report export to PDF and PNG
  - Server-side Markdown export via `GET /api/reports/:id/export/md`
- Report persistence: report JSON on disk (`reports/`) or Vercel Blob when deployed with `BLOB_READ_WRITE_TOKEN`
- Read-only sharing: `/share/:token` (7-day opt-in links; report JSON only — never your uploaded zip)
- Legacy direct view: `/report/:id` (prefer token sharing for recipients)

See [docs/roadmap.md](docs/roadmap.md) for planned work and [CHANGELOG.md](CHANGELOG.md) for shipped changes.

---

## How It Works

1. A user chooses **Upload ZIP** or **Public GitHub URL** in the web UI.
2. `POST /api/analyze` receives a multipart zip, JSON `{ githubUrl, ref? }`, or `{ sample: true }`.
3. Repo ingest extracts the upload or downloads the public GitHub archive to a temporary workspace.
4. The indexing pipeline collects:
   - folder tree
   - file metadata and language hints
   - key docs and CI config signals
   - runnable commands from `package.json` scripts
5. Language packs for TS/JS, Python, and Java compute imports, entrypoints, complexity, and proximity. The TS/JS pack builds a parser-backed `semantic_graph` (TypeScript Compiler API) and derives the folder architecture graph from resolved internal edges; see [docs/semantic-graph.md](docs/semantic-graph.md).
6. Scoring computes `start_here` ranking and `danger_zones` risk score (with optional churn dimension).
7. The interview builder assembles the **Candidate Brief** from extracted signals and evidence refs (including line-bounded semantic import evidence when present).
8. Optional commit insights run when git metadata or GitHub URL context is available.
9. The report is validated, stored, and returned by report ID.
10. The UI loads the report and supports export and sharing.

---

## Architecture

- Flow: ZIP upload or public GitHub URL -> ingest -> analyzer -> storage -> API returns report ID -> UI fetches and exports by report ID
- Runtime Architecture Map UI: interactive dependency graph using ELK layout with pan and zoom controls; when `semantic_graph` is present, the UI shows unresolved-edge counts without dumping every unresolved edge into the main graph
- Markdown artifact rendering: Mermaid syntax is used only in exported markdown artifacts, not as the runtime graph renderer
- Frontend: Next.js App Router, React, Tailwind CSS
- API routes:
  - `POST /api/analyze`
  - `GET /api/reports/:id`
  - `GET /api/reports/:id/export/md`
  - `POST /api/reports/:id/share`
  - `GET /api/share/:token`
  - `GET` / `POST /api/cron/cleanup`
- Share page: `/share/:token` (read-only UI)
- Legacy report page: `/report/:id`
- Analyzer: in-process TypeScript module
- Storage: report JSON on filesystem (`reports/`) or Vercel Blob when `BLOB_READ_WRITE_TOKEN` is set
- Temp workspace: OS temp directory per analysis run

---

## Tech Stack

- Application framework: Next.js 16, React 19, TypeScript 5
- Styling: Tailwind CSS, PostCSS, Autoprefixer
- Graph and layout: `elkjs`, `react-zoom-pan-pinch`
- Export: `html2canvas`, `jspdf`, Markdown formatter
- Testing: Vitest
- Linting: ESLint via `npm run lint`

---

## Requirements

- Node.js 20+ (`package.json` `engines`)
- npm 9+
- Windows, macOS, or Linux with local filesystem and temp directory access

---

## Quick Start

```bash
npm install
npm run dev
```

Open `http://localhost:3000`, upload a zip or paste a public GitHub URL, and click **Analyze Repository**.

---

## Screenshots

![RepoAtlas landing page](docs/images/landing.png)

![Candidate Brief with reading path and talking points](docs/images/candidate-brief.png)

![Reading path section](docs/images/reading-path.png)

![First PR plan section](docs/images/first-pr-plan.png)

### Demo (60s)

![Upload → Candidate Brief → export flow](docs/demo.gif)

Regenerate assets after UI changes:

```bash
npm run capture:portfolio
```

---

## Example Candidate Brief

Bundled sample output (not from a live deployment): [docs/examples/repoatlas-candidate-brief.md](docs/examples/repoatlas-candidate-brief.md)

You can also click **Try sample Candidate Brief** on the homepage to analyze `fixtures/repo-ts` without uploading a zip.

---

## Usage

### Web UI

- Open the homepage
- **Upload ZIP:** download from GitHub (`Code → Download ZIP`) or zip your tree locally
- **GitHub URL:** paste `https://github.com/owner/repo` (public repos only; optional ref field for branch/tag)
- View generated tabs:
  - **Candidate Brief** (default)
  - Overview
  - Folder Map
  - Architecture Map
  - Start Here
  - Danger Zones
  - Run and Contribute
  - Export
- Click **Try sample Candidate Brief** for a zero-upload demo

### Export options

- PDF: full report snapshot export
- PNG: full report snapshot export
- Markdown: `GET /api/reports/:id/export/md`, also available from UI export controls

### API: multipart upload or public GitHub URL

Primary upload flow (multipart ZIP):

```bash
curl -X POST http://localhost:3000/api/analyze \
  -F "file=@/path/to/repo.zip"
```

Public GitHub URL flow (JSON):

```bash
curl -X POST http://localhost:3000/api/analyze \
  -H "Content-Type: application/json" \
  -d '{"githubUrl":"https://github.com/owner/repo"}'
```

> The public API accepts only multipart ZIP uploads and public `githubUrl`
> values. A caller-controlled `zipRef` path is intentionally **rejected** with
> `400 INVALID_INPUT` — the server never reads arbitrary local paths supplied by
> a request.

After analysis, fetch the report JSON:

```bash
curl http://localhost:3000/api/reports/<report-id>
```

Export the report as Markdown:

```bash
curl -OJ http://localhost:3000/api/reports/<report-id>/export/md
```

---

## API Reference

### Source-of-truth route table

These routes are implemented from the files in `src/app/api/**/route.ts`:

| Route file | Methods | Public endpoint |
| --- | --- | --- |
| `src/app/api/analyze/route.ts` | `POST` | `/api/analyze` |
| `src/app/api/reports/[id]/route.ts` | `GET` | `/api/reports/:id` |
| `src/app/api/reports/[id]/share/route.ts` | `POST` | `/api/reports/:id/share` |
| `src/app/api/share/[token]/route.ts` | `GET` | `/api/share/:token` |
| `src/app/api/reports/[id]/export/md/route.ts` | `GET` | `/api/reports/:id/export/md` |
| `src/app/api/cron/cleanup/route.ts` | `GET`, `POST` | `/api/cron/cleanup` |

### `POST /api/analyze`

- Accepts `multipart/form-data` with a single zip file in `file` or `zip`
- Also accepts JSON with a public `githubUrl` (canonical `https://github.com/owner/repo`, optional `ref`)
- A caller-supplied `zipRef` path is rejected with `400 INVALID_INPUT`

Example JSON body:

```json
{
  "githubUrl": "https://github.com/owner/repo"
}
```

Success response:

```json
{
  "reportId": "uuid"
}
```

Common error codes exposed by the current route:

- `INVALID_INPUT`
- `ZIP_NOT_FOUND`
- `REPO_TOO_LARGE`
- `TIMEOUT`
- `ANALYSIS_FAILED`

Common statuses:

- `200` on success
- `400` for malformed payloads, unsupported content type, or a non-canonical/private GitHub URL
- `413` when the upload exceeds the configured size limit
- `500` for unexpected failures
- `504` when analysis exceeds the deadline

Report `GET`, share, and Markdown export responses are served with
`Cache-Control: no-store` so untrusted repository data is never cached by
browsers or shared CDNs. A baseline set of security headers (`nosniff`,
`SAMEORIGIN`, referrer and permissions policy, plus HSTS in production) is
applied to all responses via `next.config.js`. Production pages additionally
send the tested CSP in `securityHeaders.js`: same-origin scripts/connections,
no objects or frames, and only `data:`/`blob:` capabilities needed for report
exports. It deliberately omits `unsafe-eval` and third-party origins.

### `GET /api/reports/:id`

Returns a previously generated report by ID.

Common statuses:

- `200` with full report JSON
- `400` for invalid report IDs
- `404` when the report does not exist

### `POST /api/reports/:id/share`

Creates an opt-in, token-gated share link (7-day expiry). Returns:

```json
{
  "token": "…",
  "sharePath": "/share/…",
  "expiresAt": "ISO-8601"
}
```

### `GET /api/share/:token`

Returns `{ report, share: { expiresAt, createdAt } }` for valid, non-expired tokens.

### `GET /api/reports/:id/export/md`

Returns the report as downloadable Markdown with `text/markdown` content type.

Common statuses:

- `200` with markdown body and download headers
- `400` for invalid report IDs
- `404` when the report does not exist

> **No public delete endpoint.** RepoAtlas has no user/ownership model, so a
> guessable report id must not be able to destroy stored reports. Report
> retention is handled server-side by the TTL sweep (see cron cleanup below),
> which calls the storage library internally.

### `GET /api/cron/cleanup`

Health check when `CRON_SECRET` is set (or in non-production). Returns instructions to POST for sweep.

### `POST /api/cron/cleanup`

Runs TTL sweeps for expired reports (filesystem and Blob) and share tokens. In production, **fails closed** (`503 MISCONFIGURED`) when `CRON_SECRET` is unset. When set, requires `Authorization: Bearer <CRON_SECRET>`.

---

## Configuration

See [`.env.example`](.env.example) for the full list and [SECURITY.md](SECURITY.md) for the security model. Highlights:

- Vercel production: set `BLOB_READ_WRITE_TOKEN`
- Local development: `REPORTS_DIR` is optional when not using Blob storage and defaults to `<project-root>/reports`
- Local Blob testing: `BLOB_READ_WRITE_TOKEN` can also be set locally if you want to exercise Blob storage
- Report retention (filesystem): `REPORT_TTL_DAYS` (default 30; 7 when Blob token is set), `REPORT_MAX_COUNT` (default 100)
- Cron cleanup auth: optional `CRON_SECRET` for `POST /api/cron/cleanup`
- Rate limiting: optional `ANALYZE_RATE_LIMIT_PER_MIN`, `MAX_CONCURRENT_ANALYSES`

> **Security note:** RepoAtlas analyzes only public GitHub repositories and
> **never attaches a server-owned GitHub token** to a user-supplied repository
> request. Public GitHub API access is unauthenticated and rate-limited per
> server IP; commit-history insights degrade gracefully when unavailable.

No `.env` file is required for local development by default.

---

## Project Structure

```text
src/
  app/
    api/
      analyze/route.ts
      reports/[id]/route.ts
      reports/[id]/share/route.ts
      reports/[id]/export/md/route.ts
      share/[token]/route.ts
      cron/cleanup/route.ts
  analyzer/
    packs/
    index.ts
    pipeline.ts
    scoring.ts
  components/
  lib/
    ingest.ts
    storage.ts
    export.ts
    errors.ts
  types/
    report.ts
fixtures/
reports/
```

`reports/` is created at runtime when filesystem storage is used.

---

## Development

```bash
npm run dev            # Start Next.js dev server
npm run build          # Build for production
npm run start          # Run production build
npm run lint           # Run ESLint
npm run typecheck      # Type-check with tsc --noEmit
npm run test           # Run Vitest once
npm run test:coverage  # Run Vitest with coverage thresholds
npm run test:watch     # Run Vitest in watch mode
```

---

## Testing

- Unit and integration-style tests: Vitest, with coverage collected via `npm run test:coverage` (production `src/**` scope; non-regression thresholds enforced in `vitest.config.ts`)
- End-to-end tests: Playwright — API edge cases, full UI flows, share/export/upload, legacy report fallback
- Portfolio capture is separate: `npm run capture:portfolio` (not run during default `npm run test:e2e`)

Run:

```bash
npm run test
npm run test:e2e
npm run capture:portfolio
```

---

## Fixtures

Fixture repositories in `fixtures/`:

- `fixtures/repo-ts`
- `fixtures/repo-python`
- `fixtures/repo-java`
- `fixtures/repo-java-maven`
- `fixtures/repo-fastapi`
- `fixtures/repo-node-api`
- `fixtures/repo-monorepo`
- `fixtures/repo-docs-only`
- `fixtures/repo-no-readme`

These are used for local regression checks and analyzer test coverage.

---

## Limits and Behavior

Centralized in `src/lib/ingestLimits.ts` (see [docs/adr/002-zip-limits.md](docs/adr/002-zip-limits.md)):

| Limit | Local dev | Vercel deploy |
|-------|-----------|---------------|
| ZIP upload (compressed) | 100 MB | **4 MB** — use GitHub URL for larger public repos |
| GitHub archive download | 100 MB | 100 MB |
| Uncompressed extract total | 50 MB | 50 MB |
| Analysis timeout | 120 s | 120 s |
| Indexed files | 10,000 | 10,000 |
| Folder map depth | 10 | 10 |

When analysis cannot perform a deep language pass, warnings are added to the report output.

---

## Security Notes

See [SECURITY.md](SECURITY.md) for the full policy. Summary:

- Static file analysis only — never executes target repository code
- **Capability-link model:** report UUIDs are read-only; no public `DELETE` (retention via server-side TTL sweep)
- **No caller-controlled paths:** JSON `zipRef` is rejected on `POST /api/analyze`
- **Public GitHub only:** no server-owned `GITHUB_TOKEN` on user-supplied repo requests
- Hardened zip extraction: magic-byte validation, path traversal rejection, entry count and uncompressed size limits
- Report/share/export responses use `Cache-Control: no-store`
- Typed API errors (`ZIP_INVALID`, `REPO_TOO_LARGE`, etc.)

## No AI Required

RepoAtlas uses deterministic heuristics and extracted file signals only. It does not call external LLM APIs. Every Candidate Brief claim should trace to an evidence ref in the report.

## What We Will Not Claim

RepoAtlas does not assert vulnerabilities, production readiness, business purpose, or code correctness. Danger zones reflect structural risk signals (complexity, coupling, test proximity, churn) — not bug counts.

---

## Libraries and Licenses

The following are the direct libraries currently declared in `package.json`.

### Runtime dependencies

- `next`: application framework and server runtime
- `react`, `react-dom`: UI rendering
- `elkjs`: graph layout engine for the architecture map
- `react-zoom-pan-pinch`: pan and zoom controls for graph navigation
- `html2canvas`: DOM capture for image and PDF export
- `jspdf`: PDF generation
- `mermaid`: Markdown export diagram syntax generation
- `adm-zip`: zip extraction for uploaded repositories
- `@vercel/blob`: optional report storage when deployed on Vercel

### Development dependencies

- `typescript`: type checking and TS tooling
- `vitest`: test runner
- `eslint`, `eslint-config-next`: linting
- `tailwindcss`, `postcss`, `autoprefixer`: styling pipeline
- `@types/node`, `@types/react`, `@types/react-dom`, `@types/adm-zip`: TypeScript definitions

Third-party dependencies are distributed under their own licenses. Check each package's npm page or repository for license details.

---

## License

This project is licensed under the MIT License. See [LICENSE](LICENSE) for the full text.
