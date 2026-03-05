# RepoAtlas Guardrails (Strict, Prompt-Agnostic)

These rules are non-negotiable. If a change violates any rule, revert it or refactor until it complies.

## 0) Prime Directive
Ship the smallest correct implementation that matches the current repo’s intended behavior.
- **Default**: Maintain existing code and behavior. Do not change, refactor, or add unless the task explicitly requests it.
- **Override**: If a prompt attached to or associated with this document explicitly requests changes (features, refactors, removals, etc.), follow that prompt.
- Do not add features not requested by the current task.
- Do not add abstractions “for later.”
- Do not add new dependencies unless the task explicitly requires it.

## 1) Docs in Git (Source of Truth)
- The `docs/` folder MUST be committed to git.
- `docs/spec.md` is the canonical spec when it exists and is referenced by the task.
- `docs/guardrails.md` is always authoritative for engineering constraints.
- If a task says “do not create docs,” you must still follow existing docs, but you must not add new docs or restructure docs for that task.

## 2) Task-to-Repo Alignment (Prompt-Agnostic)
For every task, do this before coding:
- Identify the requested scope (UI-only, analyzer-only, API-only, or mixed).
- Identify hard constraints from the prompt (no deps, no API changes, etc).
- Identify which parts of `docs/spec.md` apply.
Then implement only what overlaps.

## 3) Spec Usage Without Process Collisions (Fix for prior #3/#4)
The spec is required when:
- The task references `docs/spec.md`, OR
- The change affects behavior, APIs, report schema, scoring, limits, storage, ingest, analyzer pipeline.

The spec is optional when:
- The change is purely presentational UI (layout, styling, copy) AND
- No API contracts, report schema, scoring, or analyzer behavior changes.

When the spec is optional:
- Do not invent new product behavior.
- Keep changes local and reversible.
- Update the spec only if the task explicitly asks for spec updates.

## 4) Report Schema Rule (Fix for prior #3 “shared/reportSchema.ts” mismatch)
Single source of truth for the Report shape:
- `src/types/report.ts` is authoritative for TypeScript types.
- Runtime validation is OPTIONAL for MVP unless the task requires it.

If runtime validation is implemented:
- Use a minimal validator (prefer no new deps; if required, justify).
- Validate at the boundary: when reading stored JSON and before saving a report.
- Never change schema without updating:
  - types
  - export formatter
  - UI renderers
  - fixtures/tests

Do NOT create `shared/reportSchema.ts` unless a task explicitly requires it.
If created later, it must mirror `src/types/report.ts` exactly and cannot diverge.

## 5) Analyzer Invocation Rule (Fix for prior #5 “worker process” mismatch)
Do not refactor the analyzer invocation model unless explicitly requested.
- Current default: in-process analyzer call from API route is acceptable.
- Introducing worker threads or child processes is forbidden unless:
  - a task explicitly demands it, AND
  - acceptance criteria mention performance/isolation needs.

If a task requires a worker:
- Implement the smallest viable worker pattern.
- Keep API contracts unchanged.
- Keep analyzer logic pure and reusable.

## 6) Evidence-Only Output Rule
RepoAtlas must never claim anything it cannot prove from repo files.
- No “this file has bugs” claims. Use “risk signals” and show breakdown.
- Every Start Here reason must be derived from measurable signals.
- Best-effort signals must be labeled in `report.warnings`.

## 7) Supported Scope and Degradation
- Universal layer must work for any repo:
  - folder tree
  - docs discovery
  - CI discovery
  - run commands extraction (best effort)
- Language packs may add deeper signals.
- If unsupported, skip and warn. Never fake.

## 8) Graph Rules
- Dependency graphs must come from real import edges for the supported language pack.
- Render reduced graphs by default (folder/module level).
- Enforce node/edge caps. If reduced, warn.

## 9) Scoring Rules
- Start Here and Danger Zones must have explicit formulas in code.
- Normalize within the repo (percentiles or capped scaling).
- Risk score must be 0–100 with a per-factor breakdown.
- No magic numbers without a comment explaining the intent.

## 10) API and Data Integrity
- Do not change API contracts unless explicitly requested.
- Validate inputs at API boundaries.
- Stored reports must be readable across versions, or versioned.

## 11) Dependencies Policy
- Prefer built-in Node/Next APIs.
- Add dependencies only when required by the task.
- Any new dependency must include:
  - why it is necessary
  - alternatives considered
  - maintenance risk note

## 12) Testing Policy
- Every new parser or scoring change requires unit tests.
- Maintain fixtures:
  - tiny TS repo
  - tiny Python repo
  - tiny Java repo
- Do not merge changes that break fixtures or golden outputs.

## 13) PR Rules
Each PR must include:
- Scope label: UI-only / API-only / analyzer-only / mixed
- What changed
- Why it was needed
- How it was tested
