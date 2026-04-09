# RepoAtlas

RepoAtlas is a local-first repository analysis app that generates a structured Repo Brief for onboarding, reviews, and architecture understanding.

It analyzes repository files without executing them and produces:

- Folder Map: recursive directory tree
- Architecture Map: interactive ELK-based dependency graph with pan and zoom
- Start Here: ranked reading path with signal-based explanations
- Danger Zones: risk-ranked hotspots with metric breakdowns
- Run and Contribute: extracted run commands, key docs, and CI indicators
- Export: full report as PDF, PNG, or Markdown

Deep analysis is currently implemented for TypeScript/JavaScript, Python, and Java repositories.

The primary workflow is zip upload through the web UI. RepoAtlas extracts the archive, analyzes the repository, stores the report, and returns a report ID that the UI can load or export.

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
- [Development](#development)
- [Testing](#testing)
- [Fixtures](#fixtures)
- [Limits and Behavior](#limits-and-behavior)
- [Security Notes](#security-notes)
- [Libraries and Licenses](#libraries-and-licenses)
- [License](#license)

---

## Features

- Single-input workflow: upload a zip of your repo and generate a report
- Deterministic scoring: Start Here and Danger Zones are derived from measurable repo signals
- Multi-language packs: TS/JS, Python, and Java packs provide deeper static analysis
- Interactive visualization: pan and zoom dependency view with ELK layout
- Portable exports:
  - Client-side full report export to PDF and PNG
  - Server-side Markdown export via `GET /api/reports/:id/export/md`
- Report persistence: report JSON on disk (`reports/`) or Vercel Blob when deployed with `BLOB_READ_WRITE_TOKEN`

---

## How It Works

1. A user uploads a zip file from the web UI.
2. `POST /api/analyze` receives the file, saves it to a temp path, and starts analysis.
3. Repo ingest extracts the zip to a temporary workspace.
4. The indexing pipeline collects:
   - folder tree
   - file metadata and language hints
   - key docs and CI config signals
   - runnable commands from `package.json` scripts
5. Language packs for TS/JS, Python, and Java compute imports, entrypoints, complexity, and proximity.
6. Scoring computes:
   - `start_here` ranking
   - `danger_zones` risk score
7. The report is saved and returned by report ID.
8. The UI loads the report and supports export.

---

## Architecture

- Flow: zip upload or JSON `zipRef` -> ingest -> analyzer -> storage -> API returns report ID -> UI fetches and exports by report ID
- Runtime Architecture Map UI: interactive dependency graph using ELK layout with pan and zoom controls
- Markdown artifact rendering: Mermaid syntax is used only in exported markdown artifacts, not as the runtime graph renderer
- Frontend: Next.js App Router, React, Tailwind CSS
- API routes:
  - `POST /api/analyze`
  - `GET /api/reports/:id`
  - `GET /api/reports/:id/export/md`
- Analyzer: in-process TypeScript module
- Storage: report JSON on filesystem (`reports/`) or Vercel Blob when `BLOB_READ_WRITE_TOKEN` is set
- Temp workspace: OS temp directory per analysis run

---

## Tech Stack

- Application framework: Next.js 14, React 18, TypeScript 5
- Styling: Tailwind CSS, PostCSS, Autoprefixer
- Graph and layout: `elkjs`, `react-zoom-pan-pinch`
- Export: `html2canvas`, `jspdf`, Markdown formatter
- Testing: Vitest
- Linting: ESLint via `next lint`

---

## Requirements

- Node.js 18+
- npm 9+
- Windows, macOS, or Linux with local filesystem and temp directory access

---

## Quick Start

```bash
npm install
npm run dev
```

Open `http://localhost:3000`, upload a zip of your repository, and click `Analyze Repository`.

---

## Usage

### Web UI

- Open the homepage
- Upload a zip of your repository, for example from GitHub: `Code -> Download ZIP`
- View generated tabs:
  - Overview
  - Folder Map
  - Architecture Map
  - Start Here
  - Danger Zones
  - Run and Contribute
  - Export

### Export options

- PDF: full report snapshot export
- PNG: full report snapshot export
- Markdown: `GET /api/reports/:id/export/md`, also available from UI export controls

### API: multipart upload or JSON `zipRef`

Primary upload flow:

```bash
curl -X POST http://localhost:3000/api/analyze \
  -F "file=@/path/to/repo.zip"
```

Testing or CLI flow:

```bash
curl -X POST http://localhost:3000/api/analyze \
  -H "Content-Type: application/json" \
  -d "{\"zipRef\":\"C:/path/to/local/repo-or-fixture\"}"
```

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
| `src/app/api/reports/[id]/export/md/route.ts` | `GET` | `/api/reports/:id/export/md` |

### `POST /api/analyze`

- Accepts `multipart/form-data` with a single zip file in `file` or `zip`
- Also accepts JSON with `zipRef` for local testing
- Max upload size: 100 MB

Example JSON body:

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

Common error codes exposed by the current route:

- `INVALID_INPUT`
- `ZIP_NOT_FOUND`
- `REPO_TOO_LARGE`
- `TIMEOUT`
- `ANALYSIS_FAILED`

Common statuses:

- `200` on success
- `400` for malformed payloads or unsupported content type
- `404` when JSON `zipRef` does not exist
- `413` when upload exceeds 100 MB
- `500` for unexpected failures
- `504` when analysis exceeds 120 seconds

### `GET /api/reports/:id`

Returns a previously generated report by ID.

Common statuses:

- `200` with full report JSON
- `400` for invalid report IDs
- `404` when the report does not exist

### `GET /api/reports/:id/export/md`

Returns the report as downloadable Markdown with `text/markdown` content type.

Common statuses:

- `200` with markdown body and download headers
- `400` for invalid report IDs
- `404` when the report does not exist

---

## Configuration

- Vercel production: set `BLOB_READ_WRITE_TOKEN`
- Local development: `REPORTS_DIR` is optional when not using Blob storage and defaults to `<project-root>/reports`
- Local Blob testing: `BLOB_READ_WRITE_TOKEN` can also be set locally if you want to exercise Blob storage

No `.env` file is required for local development by default.

---

## Project Structure

```text
src/
  app/
    api/
      analyze/route.ts
      reports/[id]/route.ts
      reports/[id]/export/md/route.ts
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
npm run dev         # Start Next.js dev server
npm run build       # Build for production
npm run start       # Run production build
npm run lint        # Run ESLint
npm run test        # Run Vitest once
npm run test:watch  # Run Vitest in watch mode
```

---

## Testing

- Unit and integration-style tests are written with Vitest
- Coverage includes analyzer packs, scoring, ingest, API routes, and report export flows

Run:

```bash
npm run test
```

---

## Fixtures

Fixture repositories in `fixtures/`:

- `fixtures/repo-ts`
- `fixtures/repo-python`
- `fixtures/repo-java`
- `fixtures/repo-java-maven`
- `fixtures/repo-docs-only`

These are used for local regression checks and analyzer test coverage.

---

## Limits and Behavior

Current enforced or expected limits:

- Analysis timeout: 120 seconds
- Repository size guard: approximately 100 MB
- File indexing cap: 10,000 files
- Directory map depth cap: 10

When analysis cannot perform a deep language pass, warnings are added to the report output.

---

## Security Notes

- RepoAtlas performs static file analysis only
- It does not execute target repository code
- Temporary workspaces are cleaned up after analysis
- Input and known failure modes are mapped to typed API errors

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
