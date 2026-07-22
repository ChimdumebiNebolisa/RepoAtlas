# Analyzer evaluation suite

RepoAtlas rankings and graphs are structural signals. This suite measures whether those signals match **human-labeled expectations** on fixture repositories — not whether the UI looks complete.

## Layout

| Path | Role |
|------|------|
| `eval/gold/*.json` | Gold labels per fixture (entrypoints, internal edges, commands, onboarding files, high-coupling files) |
| `src/analyzer/eval/` | Metrics helpers, fixture runner, Vitest gate |

## Metrics

For each gold file the runner reports:

- Entrypoint precision / recall / F1
- Internal-edge precision / recall / F1 (file → file imports from language packs)
- Run-command precision / recall
- Onboarding hit rate (gold files present in Start Here top 8)
- High-coupling hit rate (gold files present in Danger Zones top 5 or Start Here top 8)

`known_gaps` documents accuracy limits (for example regex Python/Java cases) so floors can stay honest instead of overstating parity with the TypeScript Compiler API pack.

## Run

```bash
npm test -- src/analyzer/eval/eval.test.ts
```

## Expanding the gold set

Add a fixture under `fixtures/`, label a matching `eval/gold/<name>.json`, and keep floors in `eval.test.ts` aligned with demonstrated accuracy. Prefer unfamiliar real-world shapes (alias-heavy TS, unusual Python imports, Gradle Kotlin DSL) over more UI fixtures.
