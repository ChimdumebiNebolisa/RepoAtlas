# RepoAtlas

RepoAtlas takes a GitHub repo URL or a local path and generates a **Repo Brief** with:

- **Folder Map** – Directory tree
- **Architecture Map** – Dependency graph (Mermaid.js)
- **Start Here** – Prioritized reading list
- **Danger Zones** – Risk-ranked files
- **Run and Contribute** – Extracted commands and signals
- **Markdown Export** – Full report download

See [docs/spec.md](docs/spec.md) for the full engineering specification.

## Quick Start

```bash
npm install
npm run dev
```

Open http://localhost:3000, paste a GitHub URL, and click **Analyze**.

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
- `fixtures/repo-python` – Python (main, utils, test)
- `fixtures/repo-java` – Java (Main, Utils, UtilsTest)

To test with a local fixture via zip path, use the API directly:

```bash
curl -X POST http://localhost:3000/api/analyze \
  -H "Content-Type: application/json" \
  -d '{"zipRef": "C:/path/to/fixtures/repo-ts"}'
```

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
