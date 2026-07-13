# Semantic graph guarantees and limitations

RepoAtlas persists an optional `semantic_graph` on reports (`report_version` ≥ 3) as the source of truth for TypeScript/JavaScript dependency analysis. The folder-level `architecture` field is **derived** from `resolved_internal` edges so existing UI consumers keep working.

## Guarantees (TS/JS adapter)

- Imports and re-exports are extracted from the TypeScript Compiler API AST, not regular expressions.
- Comments and string/template contents do not create edges.
- Every import/export edge includes workspace-relative path evidence with line bounds and a bounded snippet.
- Resolution statuses are explicit: `resolved_internal`, `resolved_external`, `unresolved`, or `ignored`.
- Fan-in / fan-out and the architecture graph use **only** `resolved_internal` edges.
- Unresolved and external edges are recorded (and summarized in UI/Markdown) without being dropped silently.
- Graph serialization is deterministic (sorted nodes/edges) for stable diffs when timestamps are excluded.
- Analysis never executes repository code and never traverses outside the extracted workspace.

## Supported resolution features

- Relative and extensionless imports, directory indexes
- `tsconfig.json` / `jsconfig.json` `baseUrl` and `paths`
- `package.json` `main` / `module` / `types` / `exports` (deterministic object keys; patterned exports may be recorded as unresolved with `unsupported_package_exports`)
- npm `workspaces` and `pnpm-workspace.yaml` package name resolution
- Dynamic `import()` / `require()` with string literals; non-literal callees become `unresolved` with `non_literal_specifier`

## Complexity

TS/JS complexity is a **structural complexity score** derived from AST decision points, nesting depth, and LOC. RepoAtlas does **not** claim McCabe cyclomatic complexity unless a future change documents an identical formula.

## Limitations / follow-ups

- Python and Java packs still use their existing analyzers; they do not yet emit `semantic_graph`.
- Patterned `exports` maps, arbitrary package-export conditions, and some project-reference layouts may remain unresolved.
- `.d.ts` files can appear as resolved targets but are not treated as runtime entrypoints by themselves.
- Folder architecture remains capped (50 nodes / 200 edges) for UI readability.
