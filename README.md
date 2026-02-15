# RepoAtlas

RepoAtlas analyzes repositories and generates a **Repo Brief** with:

- **Folder Map** – Directory tree
- **Architecture Map** – Interactive ELK-based dependency map (zoom/pan)
- **Start Here** – Prioritized reading list
- **Danger Zones** – Risk-ranked files
- **Run and Contribute** – Extracted commands and signals
- **Export** – Full report download as PDF, PNG, or Markdown

Deep analysis (import graph, entrypoints, complexity, Start Here, Danger Zones) is supported for **TypeScript/JavaScript**, **Python**, and **Java** repositories.

See [docs/spec.md](docs/spec.md) for the full engineering specification.

## Quick Start

```bash
npm install
npm run dev
```

Open http://localhost:3000, paste a GitHub URL, and click **Analyze**.

## Input Modes

- **Web UI**: Public GitHub URLs
- **API/testing**: `githubUrl` or local `zipRef` path

## Development

```bash
npm run dev      # Start dev server
npm run build    # Production build
npm run test     # Run tests
npm run lint     # Lint
```

## Fixtures

Small test repos in `fixtures/`:

- `fixtures/repo-ts` – TypeScript (index, utils, test)
- `fixtures/repo-python` – Python (main, utils, myapp package, pyproject.toml, tests)
- `fixtures/repo-java` – Java (Main, Utils, UtilsTest)
- `fixtures/repo-java-maven` – Java Maven-style project layout
- `fixtures/repo-docs-only` – Docs-only repository fixture

To test with a local fixture path, use the API directly:

```bash
curl -X POST http://localhost:3000/api/analyze \
  -H "Content-Type: application/json" \
  -d '{"zipRef": "C:/path/to/fixtures/repo-ts"}'
```

## Current Limits

- Public GitHub repositories only
- Clone size limit: ~100MB
- Analysis timeout: 120 seconds

## Project Structure

```
src/
  app/           # Next.js App Router (pages, API routes)
  analyzer/      # Indexing pipeline, language packs, scoring
  components/    # React UI components
  lib/           # Ingest, storage, export
  types/         # Report schema
docs/
  spec.md        # Engineering specification
fixtures/        # Test repositories
```

## License

MIT
