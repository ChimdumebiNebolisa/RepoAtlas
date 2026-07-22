# RepoAtlas

**Deterministic, no-AI repository analysis** — upload a repo zip or paste a **public GitHub URL** and get an evidence-backed **Candidate Brief** for an interview walkthrough, bug investigation, planned change, or pull-request discussion.

RepoAtlas reads repository files as text only (never executes them). Primary output is a **Candidate Brief** (reading path, talking points, first PR ideas, resume bullets, walkthrough script, evidence index). Supporting tabs: Folder Map, Architecture Map, Start Here, Danger Zones, Run and Contribute, and Export (PDF/PNG always; Markdown when report storage is available).

**Language depth is uneven by design of the current packs:** TypeScript/JavaScript uses the TypeScript Compiler API (AST-backed imports and evidence). Python and Java use structured heuristics (mostly regex/text). Rankings are repository-relative structural signals, not calibrated defect or risk probabilities — see [docs/adr/003-scoring-semantics.md](docs/adr/003-scoring-semantics.md) and [eval/README.md](eval/README.md).

Two input modes:

- **Upload ZIP** — local snapshots; up to **100 MB** compressed locally, **4 MB** on Vercel. Prefer GitHub URL for larger public repos when deployed.
- **Public GitHub URL** — `https://github.com/owner/repo` with optional branch/tag; archive streamed up to 100 MB compressed.

When storage is available, the server saves the report and returns a report ID. When storage is unavailable or save fails, the completed report is returned inline so the UI can still render and export PDF/PNG. Markdown downloads and saved report URLs require persistence.

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
- [Fixtures and evaluation](#fixtures-and-evaluation)
- [Limits and Behavior](#limits-and-behavior)
- [Security Notes](#security-notes)
- [Libraries and Licenses](#libraries-and-licenses)
- [License](#license)

---

## Features

- Dual input: ZIP upload, public GitHub URL, or bundled sample brief
- Deterministic Start Here / Danger Zones from measurable repo signals (no LLM)
- Language packs: TS/JS (AST), Python and Java (heuristic) — see depth note above
- Interactive ELK architecture graph with pan/zoom
- Exports: client PDF/PNG; server Markdown for saved reports
- Best-effort persistence (`reports/` or Vercel Blob via OIDC / `BLOB_READ_WRITE_TOKEN`)
- Private sharing: 7-day saved-report tokens at `/share/:token`, or encrypted portable fragment at `/share/portable#…`

See [docs/roadmap.md](docs/roadmap.md) and [CHANGELOG.md](CHANGELOG.md).

---

## How It Works

1. User chooses **Upload ZIP** or **Public GitHub URL**.
2. `POST /api/analyze` receives multipart zip, JSON `{ githubUrl, ref? }`, or `{ sample: true }`.
3. Ingest extracts the upload or downloads the public archive (GitHub refs resolve to an immutable commit SHA first).
4. Indexing builds folder tree, file metadata, docs/CI signals, and run commands.
5. Language packs compute imports, entrypoints, complexity, and proximity. TS/JS builds a parser-backed `semantic_graph`; see [docs/semantic-graph.md](docs/semantic-graph.md).
6. Scoring produces `start_here` and `danger_zones` (optional churn when commit history is available for the **same** ingested tip).
7. Interview builder assembles the Candidate Brief from signals and evidence refs.
8. Report is validated; the server attempts to save it when storage is configured.
9. Saved results return `{ reportId, persisted: true }`; unsaved results return `{ reportId, report, persisted: false }` for inline UI.

---

## Architecture

- Flow: ZIP or GitHub URL → ingest → analyzer → best-effort storage → saved fetch or inline UI
- Analyzer: `worker_threads` isolation by default (in-process under Vitest / `ANALYZE_INLINE=1`), with fallback if the worker cannot start
- Storage: filesystem `reports/` or Vercel Blob; same-SHA GitHub analysis cache under `reports/analysis-cache/` (or Blob)
- Temp workspace: OS temp directory per run
- API: `POST /api/analyze`, report/share/export routes, `GET|POST /api/cron/cleanup`
- Pages: `/`, `/interview-preparation`, `/privacy`, `/terms`, `/contact`, `/share/:token`, legacy `/report/:id`

---

## Tech Stack

Next.js 16, React 19, TypeScript 5, Tailwind CSS, `elkjs`, `react-zoom-pan-pinch`, `html2canvas`, `jspdf`, Vitest, Playwright, ESLint.

---

## Requirements

- Node.js 20+ (`package.json` `engines`)
- npm 9+
- Local filesystem and temp directory access

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

```bash
npm run capture:portfolio
```

---

## Example Candidate Brief

Bundled sample: [docs/examples/repoatlas-candidate-brief.md](docs/examples/repoatlas-candidate-brief.md). Homepage **Try sample Candidate Brief** analyzes `fixtures/repo-ts` without uploading.

---

## Usage

### Web UI

- **Upload ZIP** or **GitHub URL** (`https://github.com/owner/repo`, optional branch/tag)
- Tabs: Candidate Brief (default), Overview, Folder Map, Architecture Map, Start Here, Danger Zones, Run and Contribute, Export
- PDF/PNG for saved and inline reports; Markdown only when the report was saved

### API examples

```bash
curl -X POST http://localhost:3000/api/analyze \
  -F "file=@/path/to/repo.zip"

curl -X POST http://localhost:3000/api/analyze \
  -H "Content-Type: application/json" \
  -d '{"githubUrl":"https://github.com/owner/repo"}'
```

Caller-controlled `zipRef` paths are rejected (`400 INVALID_INPUT`).

```bash
curl http://localhost:3000/api/reports/<report-id>
curl -OJ http://localhost:3000/api/reports/<report-id>/export/md
```

---

## API Reference

### Source-of-truth route table

| Route file | Methods | Public endpoint |
| --- | --- | --- |
| `src/app/api/analyze/route.ts` | `POST` | `/api/analyze` |
| `src/app/api/reports/[id]/route.ts` | `GET` | `/api/reports/:id` |
| `src/app/api/reports/[id]/share/route.ts` | `POST` | `/api/reports/:id/share` |
| `src/app/api/share/[token]/route.ts` | `GET` | `/api/share/:token` |
| `src/app/api/reports/[id]/export/md/route.ts` | `GET` | `/api/reports/:id/export/md` |
| `src/app/api/cron/cleanup/route.ts` | `GET`, `POST` | `/api/cron/cleanup` |

### `POST /api/analyze`

- Multipart zip in `file` or `zip`, or JSON `{ githubUrl, ref? }`
- `zipRef` rejected with `400 INVALID_INPUT`

Saved success: `{ "reportId": "uuid", "persisted": true }`  
Inline success: `{ "reportId": "uuid", "persisted": false, "report": { ... } }`

Common errors: `INVALID_INPUT`, `ZIP_NOT_FOUND`, `REPO_TOO_LARGE`, `TIMEOUT`, `ANALYSIS_FAILED`.  
Statuses: `200`, `400`, `413`, `500`, `504`.

Report GET/share/export use `Cache-Control: no-store`. Security headers (including production CSP) come from `next.config.js` / `securityHeaders.js`.

### `GET /api/reports/:id`

`200` report JSON; `400` invalid id; `404` missing.

### `POST /api/reports/:id/share`

Returns `{ token, sharePath, expiresAt }` (7-day token).

### `GET /api/share/:token`

Returns `{ report, share }` for valid tokens. Inline reports use `/share/portable#…` in the browser instead (no server fetch of report bytes).

### `GET /api/reports/:id/export/md`

Downloadable Markdown for saved reports only.

> **No public delete endpoint.** Retention is the server-side TTL sweep via cron cleanup.

### Cron cleanup

- `GET /api/cron/cleanup` — health/instructions when configured
- `POST /api/cron/cleanup` — TTL sweeps; production fails closed without `CRON_SECRET`

---

## Configuration

See [`.env.example`](.env.example) and [SECURITY.md](SECURITY.md). Highlights:

- Vercel: private Blob store (OIDC) for saved reports; without Blob, analysis still completes inline
- Local: `REPORTS_DIR` defaults to `<project-root>/reports`
- Retention: `REPORT_TTL_DAYS`, `REPORT_MAX_COUNT`; cron auth via `CRON_SECRET`
- Rate limiting: process-local `ANALYZE_RATE_LIMIT_PER_MIN`, `MAX_CONCURRENT_ANALYSES` (not distributed across serverless isolates)

RepoAtlas analyzes only public GitHub repositories and never attaches a server-owned GitHub token to user-supplied requests.

---

## Project Structure

```text
src/app/api/          # analyze, reports, share, cron
src/analyzer/         # pipeline, packs, scoring, interview, eval harness
src/components/       # report UI
src/lib/              # ingest, storage, export, validation
fixtures/             # regression repositories
eval/gold/            # human-labeled analyzer expectations
reports/              # runtime filesystem storage (gitignored)
```

---

## Development

```bash
npm run dev
npm run build
npm run start
npm run lint
npm run typecheck
npm run test
npm run test:coverage
npm run test:e2e
```

---

## Testing

- Unit/integration: Vitest (`npm run test`, coverage via `npm run test:coverage`)
- E2E: Playwright (`npm run test:e2e`). If a dev server already owns port 3000, use `PLAYWRIGHT_PORT=3100 npm run test:e2e` so Playwright starts its own server (see `AGENTS.md`)
- Analyzer accuracy floors: `npm test -- src/analyzer/eval/eval.test.ts`
- Portfolio capture (separate from default e2e): `npm run capture:portfolio`

Stale `.playwright-reports/` can contaminate share/report tests — delete it (and `test-results/`) if e2e fails unexpectedly.

---

## Fixtures and evaluation

Regression fixtures live under `fixtures/` (`repo-ts`, `repo-python`, `repo-java`, `repo-java-maven`, `repo-fastapi`, `repo-node-api`, `repo-monorepo`, and smaller edge cases).

Human-labeled gold expectations and metrics live under [`eval/`](eval/README.md). Expanding that gold set is the preferred path to improving analyzer trust — ahead of new UI surface area.

---

## Limits and Behavior

Centralized in `src/lib/ingestLimits.ts` ([docs/adr/002-zip-limits.md](docs/adr/002-zip-limits.md)):

| Limit | Local dev | Vercel deploy |
|-------|-----------|---------------|
| ZIP upload (compressed) | 100 MB | **4 MB** (use GitHub URL for larger public repos) |
| GitHub archive download | 100 MB | 100 MB |
| Uncompressed extract total | 50 MB | 50 MB |
| Analysis timeout | 120 s | 120 s |
| Indexed files | 10,000 | 10,000 |
| Folder map depth | 10 | 10 |

When a deep language pass cannot run, warnings are added to the report.

---

## Security Notes

See [SECURITY.md](SECURITY.md). Summary:

- Static analysis only — never executes target code
- Capability-link report access; no public `DELETE`
- No caller-controlled filesystem paths (`zipRef` rejected)
- Public GitHub only; hardened ZIP extraction (magic bytes, traversal/collision rejection, size/entry caps)
- `Cache-Control: no-store` on report/share/export

**No AI.** Deterministic heuristics and extracted signals only; Candidate Brief claims should trace to evidence refs.

**What we will not claim.** No vulnerabilities, production readiness, business purpose, or code correctness. Danger Zones are structural signals (size, coupling, complexity, test proximity, optional churn) — not bug counts or calibrated absolute risk.

---

## Libraries and Licenses

Direct runtime dependencies: `next`, `react`, `react-dom`, `elkjs`, `react-zoom-pan-pinch`, `html2canvas`, `jspdf`, `mermaid`, `adm-zip`, `@vercel/blob`. Dev tooling: TypeScript, Vitest, Playwright, ESLint, Tailwind/PostCSS. See `package.json` for versions and each package’s license.

---

## License

MIT — see [LICENSE](LICENSE).
