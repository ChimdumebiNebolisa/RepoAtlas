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
- [Roadmap and Spec](#roadmap-and-spec)
- [Libraries and Licenses](#libraries-and-licenses)
- [License](#license)

---

## Features

- **Single-input workflow**: paste a public GitHub URL and generate a report.
- **Deterministic scoring**: Start Here and Danger Zones are derived from measurable repo signals.
- **Multi-language packs**: TS/JS, Python, and Java packs provide deeper static analysis.
- **Interactive visualization**: pan/zoom dependency view with ELK layout.
- **Portable exports**:
  - Client-side full report export to **PDF** and **PNG**
  - API export to **Markdown** (`/api/reports/:id/export/md`)
- **Local report persistence**: report JSON is stored on disk under `reports/` (or custom path).

---

## How It Works

1. User submits a GitHub repository URL from the web UI.
2. `POST /api/analyze` validates input and starts analysis.
3. Repo ingest clones the repository to a temporary workspace.
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

- **Frontend**: Next.js App Router + React + Tailwind CSS
- **API routes**:
  - `POST /api/analyze`
  - `GET /api/reports/:id`
  - `GET /api/reports/:id/export/md`
- **Analyzer**: in-process TypeScript worker-style module
- **Storage**: filesystem JSON files (`reports/<reportId>.json`)
- **Temp workspace**: OS temp directory per analysis run

See `docs/spec.md` for the complete engineering specification.

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
- **git**: required for repository cloning
- **OS**: Windows, macOS, or Linux (local filesystem + temp directory access)

---

## Quick Start

```bash
npm install
npm run dev
```

Open `http://localhost:3000`, paste a public GitHub URL, and click **Analyze Repository**.

---

## Usage

### Web UI (primary flow)

- Open the homepage.
- Enter a public GitHub URL (`https://github.com/owner/repo`).
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
- **Markdown**: `GET /api/reports/:id/export/md`

### API/testing flow with local path input

The API also accepts a `zipRef` path input (used for local testing and fixtures):

```bash
curl -X POST http://localhost:3000/api/analyze \
  -H "Content-Type: application/json" \
  -d '{"zipRef":"C:/path/to/repo-or-fixture"}'
```

---

## API Reference

### `POST /api/analyze`

Request body (exactly one required):

```json
{
  "githubUrl": "https://github.com/owner/repo"
}
```

or

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
- `INVALID_URL`
- `ZIP_NOT_FOUND`
- `REPO_TOO_LARGE`
- `CLONE_TIMEOUT`
- `TIMEOUT`
- `REPO_NOT_PUBLIC`
- `CLONE_FAILED`
- `ANALYSIS_FAILED`

### `GET /api/reports/:id`

Returns the full report JSON.

### `GET /api/reports/:id/export/md`

Returns a downloadable markdown file named `repo-brief-<id>.md`.

---

## Configuration

Environment variables:

- `REPORTS_DIR` (optional): absolute/relative path for persisted report JSON files.  
  Default: `<project-root>/reports`

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
docs/
  spec.md
  guardrails.md
fixtures/
reports/
```

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

- Public GitHub repositories only (for `githubUrl` flow)
- Clone timeout: 60 seconds
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

## Roadmap and Spec

- Engineering spec: `docs/spec.md`
- Project guardrails: `docs/guardrails.md`

The spec contains product goals, scoring design, API contracts, and acceptance criteria.

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
- `mermaid` - diagram support (used for markdown architecture export compatibility)

### Development dependencies

- `typescript` - static typing and TS tooling
- `vitest` - test runner
- `eslint`, `eslint-config-next` - linting rules and integration
- `tailwindcss`, `postcss`, `autoprefixer` - styling pipeline
- `@types/node`, `@types/react`, `@types/react-dom` - TypeScript type definitions

Third-party dependencies are distributed under their own respective licenses; check each package's npm page/repository for full license text.

---

## License

This project is licensed under the **MIT License**.  
See the [LICENSE](LICENSE) file for the full text.
