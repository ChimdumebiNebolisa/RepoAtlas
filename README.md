# RepoAtlas

RepoAtlas is a local-first repository analysis app that generates a structured **Repo Brief** for onboarding, reviews, and architecture understanding.

It analyzes repository files (without executing code) and produces:

- **Folder Map**: recursive directory tree
- **Architecture Map**: interactive ELK-based dependency graph (zoom/pan)
- **Start Here**: ranked reading path with signal-based explanations
- **Danger Zones**: risk-ranked hotspots with metric breakdowns
- **Run & Contribute**: extracted run commands, key docs, and CI indicators
- **Export**: full report as **PDF**, **PNG**, or **Markdown**

Deep analysis is currently implemented for **TypeScript/JavaScript**, **Python**, and **Java** repositories.

Upload a zip of your repository; we extract it, analyze the folder, and return a Repo Brief.

---

## Table of Contents

- [Features](#features)
- [How It Works](#how-it-works)
- [Architecture](#architecture)
- [Tech Stack](#tech-stack)
- [Requirements](#requirements)
- [Quick Start](#quick-start)
- [Usage](#usage)
- [API Reference](#api-reference)
- [Configuration](#configuration)
- [Project Structure](#project-structure)
- [Testing](#testing)
- [Fixtures](#fixtures)
- [Limits and Behavior](#limits-and-behavior)
- [Security Notes](#security-notes)
- [Libraries and Licenses](#libraries-and-licenses)
- [License](#license)

---

## Features

- **Single-input workflow**: upload a zip of your repo and generate a report.
- **Deterministic scoring**: Start Here and Danger Zones are derived from measurable repo signals.
- **Multi-language packs**: TS/JS, Python, and Java packs provide deeper static analysis.
- **Interactive visualization**: pan/zoom dependency view with ELK layout.
- **Portable exports**:
  - Client-side full report export to **PDF** and **PNG**
  - No server-side export endpoint is currently implemented
- **Report persistence**: report JSON on disk (`reports/`) or Vercel Blob when deployed with `BLOB_READ_WRITE_TOKEN`.

---

## How It Works

1. User uploads a zip of the repository from the web UI.
2. `POST /api/analyze` receives the file, saves it to a temp path, and starts analysis.
3. Repo ingest extracts the zip to a temporary workspace.
4. Common indexing pipeline collects:
   - folder tree
   - file metadata and language hints
   - key docs and CI config signals
   - runnable commands from `package.json` scripts
5. Language packs (TS/JS, Python, Java) compute imports, entrypoints, complexity, and proximity.
6. Scoring computes:
   - `start_here` ranking
   - `danger_zones` risk score (0-100)
7. Report is saved to disk and returned by report ID.
8. UI renders tabs and supports export.

---

## Architecture

- **Flow:** Zip upload or JSON `zipRef` → ingest (extract) → analyzer (folder map, language packs, scoring) → storage (save report) → API returns report ID.
- **Frontend**: Next.js App Router + React + Tailwind CSS
- **API routes**:
  - `POST /api/analyze`
- **Analyzer**: in-process TypeScript worker-style module
- **Storage**: report JSON on filesystem (`reports/`) or Vercel Blob when `BLOB_READ_WRITE_TOKEN` is set
- **Temp workspace**: OS temp directory per analysis run

---

## Tech Stack

- **Application Framework**: Next.js 14, React 18, TypeScript 5
- **Styling**: Tailwind CSS, PostCSS, Autoprefixer
- **Graph/Layout**: `elkjs`, `react-zoom-pan-pinch`
- **Export**: `html2canvas`, `jspdf`, Markdown formatter
- **Testing**: Vitest
- **Linting**: ESLint (`eslint-config-next`)

---

## Requirements

- **Node.js**: 18+ recommended
- **npm**: 9+
- **OS**: Windows, macOS, or Linux (local filesystem + temp directory access)

---

## Quick Start

```bash
npm install
npm run dev
```

Open `http://localhost:3000`, upload a zip of your repository, and click **Analyze Repository**.

---

## Usage

### Web UI (primary flow)

- Open the homepage.
- Upload a zip of your repository (e.g. from GitHub: Code → Download ZIP).
- View generated tabs:
  - Overview
  - Folder Map
  - Architecture Map
  - Start Here
  - Danger Zones
  - Run & Contribute
  - Export

### Export options

- **PDF**: full report snapshot export
- **PNG**: full report snapshot export
- **Markdown**: available via `GET /api/reports/:id/export/md` (also available from UI export controls)

### API: multipart upload (primary) or JSON zipRef (testing)

**Primary:** Send a zip file via multipart form (field name `file` or `zip`):

```bash
curl -X POST http://localhost:3000/api/analyze \
  -F "file=@/path/to/repo.zip"
```

**Testing / CLI:** Send a local path as JSON (no upload):

```bash
curl -X POST http://localhost:3000/api/analyze \
  -H "Content-Type: application/json" \
  -d '{"zipRef":"C:/path/to/repo-or-fixture"}'
```

---

## API Reference

### Source-of-truth route table (from `src/app/api/**/route.ts`)

| Route file | Methods | Public endpoint |
|---|---|---|
| `src/app/api/analyze/route.ts` | `POST` | `/api/analyze` |
| `src/app/api/reports/[id]/route.ts` | `GET` | `/api/reports/:id` |
| `src/app/api/reports/[id]/export/md/route.ts` | `GET` | `/api/reports/:id/export/md` |

> Maintenance note: update this table only by checking the route handler files above. If route files change, update this table in the same PR.

### `POST /api/analyze`

**Primary:** `multipart/form-data` with a single zip file (field `file` or `zip`). Max 100MB.

**Optional (testing):** `Content-Type: application/json` with body:

```json
{
  "zipRef": "C:/path/to/local/repo-or-fixture"
}
```

Success response:

```json
{
  "reportId": "uuid"
}
```

Common error codes:

- `INVALID_INPUT`
- `ZIP_NOT_FOUND`
- `ZIP_INVALID`
- `REPO_TOO_LARGE`
- `TIMEOUT`
- `ANALYSIS_FAILED`

Common statuses in this route:

- `200` on success (`{ "reportId": "uuid" }`)
- `400` for malformed payloads or unsupported content type
- `404` when JSON `zipRef` path is missing
- `413` when upload exceeds 100MB
- `500` for unexpected analysis failures
- `504` when analysis exceeds 120s

### `GET /api/reports/:id`

Returns a previously generated report by ID.

Common statuses:

- `200` with full report JSON when found
- `400` for invalid report IDs
- `404` when the report does not exist

### `GET /api/reports/:id/export/md`

Returns the report as downloadable Markdown (`text/markdown`).

Common statuses:

- `200` with markdown body and download headers
- `400` for invalid report IDs
- `404` when the report does not exist

### API availability

Current implemented API routes are listed in the source-of-truth table above. The UI analyze flow starts with `POST /api/analyze`, then can read/export by report ID using `/api/reports/*`.

---

## Configuration

- **Vercel (production):** Set `BLOB_READ_WRITE_TOKEN` (from your Blob store). No `REPORTS_DIR` needed.
- **Local dev:** Optional `REPORTS_DIR` when not using Blob (default: `<project-root>/reports`). Optional `BLOB_READ_WRITE_TOKEN` if you want to test Blob locally.

No `.env` file is required for local development by default.

---

## Project Structure

```text
src/
  app/
    api/
      analyze/route.ts
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
```

`reports/` is created at runtime when using filesystem storage.

---

## Development

Scripts:

```bash
npm run dev         # Start Next.js dev server
npm run build       # Build for production
npm run start       # Run production build
npm run lint        # Run ESLint
npm run test        # Run tests once (Vitest)
npm run test:watch  # Run Vitest in watch mode
```

---

## Testing

- Unit and integration-style tests are written with Vitest.
- Tests cover analyzer packs, scoring, ingest, and error behavior.

Run:

```bash
npm run test
```

---

## Fixtures

Fixture repositories in `fixtures/`:

- `fixtures/repo-ts` (TypeScript)
- `fixtures/repo-python` (Python)
- `fixtures/repo-java` (Java)
- `fixtures/repo-java-maven` (Java Maven layout)
- `fixtures/repo-docs-only` (documentation-focused repo)

These are used for local test scenarios and analyzer regression checks.

---

## Limits and Behavior

Current enforced/expected limits:

- Analysis timeout: 120 seconds
- Repository size guard: approximately 100 MB
- File indexing cap: 10,000 files
- Directory map depth cap: 10

When analysis cannot perform a deep language pass, warnings are added to report output.

---

## Security Notes

- RepoAtlas performs **static file analysis only**.
- It does **not execute** target repository code.
- Temporary workspaces are cleaned up after analysis.
- Input and known failure modes are mapped to typed API errors for safer handling.

---

## Libraries and Licenses

The following are the direct libraries currently declared in `package.json`.

### Runtime dependencies

- `next` - React framework and server/runtime for the app
- `react`, `react-dom` - UI rendering
- `elkjs` - graph layout engine used for architecture map layout
- `react-zoom-pan-pinch` - pan/zoom controls for graph navigation
- `html2canvas` - DOM capture for image/PDF export flow
- `jspdf` - PDF file generation
- `mermaid` - diagram tooling dependency
- `adm-zip` - zip extraction for uploaded repos
- `@vercel/blob` - optional report storage when deployed on Vercel

### Development dependencies

- `typescript` - static typing and TS tooling
- `vitest` - test runner
- `eslint`, `eslint-config-next` - linting rules and integration
- `tailwindcss`, `postcss`, `autoprefixer` - styling pipeline
- `@types/node`, `@types/react`, `@types/react-dom`, `@types/adm-zip` - TypeScript type definitions

Third-party dependencies are distributed under their own respective licenses; check each package's npm page/repository for full license text.

---

## License

This project is licensed under the **MIT License**.  
See the [LICENSE](LICENSE) file for the full text.
