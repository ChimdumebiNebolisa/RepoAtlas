# RepoAtlas Daily Product Hardening Progress

Last updated: 2026-07-12 (America/Chicago)

This file is a persistent evidence record, not a substitute for checking the current default branch. Each run must compare it with source, tests, configuration, and recent history before selecting work.

## Current state

- Current phase: Phase 2 — dependency and platform security.
- Completed work unit: Phase 2 development dependency remediation for Vitest/Vite/esbuild advisories (2026-07-12).
- Current in-progress work unit: none.
- Next incomplete work unit: Phase 2 Next.js upgrade implementation assessment.
- Blockers: none. WebKit was initially absent locally and was installed; the complete mobile project then passed.

## Ordered work-unit checklist

- [x] Phase 1: baseline, repository inventory, recent-work verification, stale-branch review, and blast-radius map.
- [x] Phase 2: production dependency baseline and Next.js/PostCSS remediation.
- [x] Phase 2: development dependency remediation and audit release-gate evidence.
- [ ] Phase 2: Next.js upgrade implementation.
- [ ] Phase 2: production and development audit policies.
- [ ] Phase 2: CSP capability inventory and tested CSP.
- [ ] Phase 3: adversarial ZIP families, one boundary family per unit.
- [ ] Phase 4: end-to-end deadlines and request budgets.
- [ ] Phase 5: distributed abuse-control interface.
- [ ] Phases 6–7: deterministic analyzer fixtures and evidence-backed correctness fixes.
- [ ] Phase 8: risk-based coverage.
- [ ] Phases 9–10: frontend component and E2E accessibility coverage.
- [ ] Phase 11: complete report-schema compatibility behavior.
- [ ] Phase 12: retention and storage equivalence.
- [ ] Phases 13–14: output sanitization and large-report handling.
- [ ] Phase 15: performance and client-bundle control.
- [ ] Phase 16: privacy-safe observability.
- [ ] Phase 17: documentation reconciliation.

## Baseline inventory and blast radius

### 2026-07-12 selected work-unit blast radius

Selected work unit: Phase 2 production dependency remediation for the Next-bundled PostCSS advisory.

Blast radius: dependency resolution only (`package.json` and `package-lock.json`) plus this progress record. Runtime code, ingestion, archive extraction, analyzer behavior, report schema/storage, sharing/export APIs, frontend rendering, and Vercel configuration are not intentionally changed. Verification must prove the production audit is clean and that typecheck, lint, unit coverage, and production build still pass under the overridden dependency graph.

Result: complete. `postcss` is pinned and overridden to `8.5.16`; the lockfile no longer installs `next/node_modules/postcss@8.4.31`, and Next resolves to the patched top-level PostCSS package. This was chosen after checking `next@16.2.10` and `next@16.3.0-canary.83`; both still declare `postcss@8.4.31`, so a framework-major upgrade would not directly clear the production advisory.

### 2026-07-12 development dependency hardening

Selected work unit: Phase 2 development dependency remediation for the Vitest/Vite/esbuild advisory chain.

Blast radius: development tooling and tests only (`package.json`, `package-lock.json`, `src/lib/safeZipExtract.test.ts`, `src/lib/evidenceIndex.test.ts`, and `src/lib/elkLayout.test.ts`) plus this progress record. No production dependency, ingestion, archive limit, analyzer implementation, report schema, storage, export, frontend, or deployment configuration changed.

Result: complete. Vitest and `@vitest/coverage-v8` now resolve to the security-fixed 3.2.6 line, Vite is directly constrained to the patched 6.4.3 line, and esbuild resolves to 0.25.12. The existing 63% statements/lines coverage gate was preserved. Vitest 3's V8 coverage model measured the pre-existing suite at 62.06%, so deterministic tests were added for the previously untested evidence index and ELK layout helpers rather than lowering the threshold. The ZIP-bomb test received an explicit 20-second timeout because V8 instrumentation makes its 51 MB adversarial fixture exceed the old 5-second default; the assertion and production limit are unchanged.

Audit policy: `npm audit --omit=dev --audit-level=low` is the production dependency gate; `npm audit --audit-level=low` is the full release gate. Development dependency upgrades must clear both audits and pass typecheck, lint, coverage, build, and CI before publication. `npm audit fix --force` remains disallowed for major-version migrations without compatibility evidence.

### Systems

- Inputs and UI: `src/components/InputForm.tsx`, `HomePage.tsx`, report/share pages, and report components.
- Request boundary: `POST /api/analyze` validates multipart/JSON input, rejects network `zipRef`, applies process-local rate/concurrency controls, and creates the request deadline.
- Acquisition: `src/lib/github.ts` validates canonical public GitHub coordinates; `src/lib/ingest.ts` resolves an exact commit SHA before streaming a GitHub archive or handles a server-owned ZIP path.
- Archive boundary: `src/lib/safeZipExtract.ts` extracts under centralized limits from `src/lib/ingestLimits.ts`; analyzed repositories are read as data and never executed.
- Analysis: `src/analyzer/index.ts` drives indexing, language packs, deterministic document discovery, scoring, Candidate Brief generation, report version stamping, persistence, and cleanup.
- Schema/storage/retention: `src/types/report.ts`, `src/lib/reportSchema.ts`, `storage.ts`, `sharing.ts`, `reportTtl.ts`, and the authenticated cleanup route.
- Consumers: report and share APIs/pages, ELK runtime graph, Markdown formatter/route, and client PDF/PNG export controls.
- Verification/release: Vitest, Playwright Chromium/WebKit projects, `.github/workflows/ci.yml`, and Vercel Git integration/configuration where available.

### Producer-to-consumer trace

`InputForm` -> `/api/analyze` validation and abuse controls -> GitHub URL/ref resolution or temporary uploaded ZIP -> streamed acquisition -> jailed extraction and budgets -> analyzer pipeline/language packs/docs/scoring -> report version and runtime-validated storage -> report/share APIs -> report UI -> Markdown/PDF/PNG outputs -> TTL cleanup.

Blast radius for this completed work unit was documentation only. No runtime producer, consumer, schema, limit, API, analyzer, storage, export, or frontend behavior changed.

## Recently completed behavior that must not be rebuilt

Verified against `main` source/tests on 2026-07-11:

- Public, unauthenticated GitHub URL analysis exists and resolves a commit before archive download.
- Caller-controlled JSON `zipRef` is rejected; internal server-owned fixture/path use remains separate.
- GitHub downloads are streamed with a compressed-byte cap; extraction is bounded and temporary resources have cleanup coverage.
- Limits are centralized in `src/lib/ingestLimits.ts`; ingestion errors are typed.
- Document discovery and duplicate grouping are deterministic and covered by fixtures/tests.
- Stored reports are stamped with `report_version: 2`, validated at read time, and future versions are rejected; migration/older-version behavior remains incomplete.
- Public report deletion is absent, report/share/export responses are `no-store`, and production cron cleanup fails closed without its secret.
- Frontend repository source labels and analyzed timestamps use corrected format helpers.

## Verification results (2026-07-11)

- `git status --short`: exit 0; clean at start.
- `npm run typecheck`: exit 0.
- `npm run lint`: exit 0; no warnings/errors. Note: `next lint` deprecation warning.
- `npm run test:coverage`: exit 0; 35 files and 205 tests passed. Statements 65.69% (6761/10292), branches 79.46% (1378/1734), functions 83.79% (243/290), lines 65.69%.
- `npm run build`: exit 0; Next.js 15.5.20 production build passed. First-load JS: landing 566 kB, report 561 kB, share 564 kB, shared 103 kB. Browser data warning: `caniuse-lite` six months old.
- Initial `npm run test:e2e`: exit 1; 55 Chromium/API tests passed and 19 WebKit tests could not launch because the pinned browser binary was absent (environment-only failure).
- `npx playwright install webkit`: exit 0; installed pinned WebKit 2311.
- `npx playwright test --project=mobile`: exit 0; 37/37 passed, including the axe accessibility check. Combined evidence covers all 74 configured cases across the initial Chromium run and mobile rerun.
- PR #25's first GitHub E2E check: exit 1; 55 passed and all 19 WebKit-backed mobile cases failed to launch because CI installed Chromium only. `.github/workflows/ci.yml` was corrected to install both engines configured by `playwright.config.ts`; a fresh required-check run is publication evidence for the fix.
- `npm audit --omit=dev --audit-level=low`: exit 1; 2 moderate production findings (`postcss` XSS advisory, transitively bundled through Next.js).
- `npm audit --audit-level=low`: exit 1; 7 total findings (4 moderate, 1 high, 2 critical), including the production PostCSS path and development Vitest/Vite/esbuild paths. Do not use the audit tool's suggested downgrade to Next.js 9.3.3.

No representative analyzer performance fixture was measured in this documentation-only unit. No deploy-specific behavior was exercised.

## Verification results (2026-07-12)

- `git status --short`: exit 0 at start; clean.
- `npm view next version dist-tags --json`: exit 0; latest `16.2.10`, backport `15.5.20`, canary `16.3.0-canary.83`.
- `npm view next@16.2.10 dependencies.postcss --json`: exit 0; still `8.4.31`.
- `npm view next@16.3.0-canary.83 dependencies.postcss --json`: exit 0; still `8.4.31`.
- `npm audit --omit=dev --audit-level=low` before remediation: exit 1; 2 moderate production findings from `next/node_modules/postcss <8.5.10`.
- `npm install --package-lock-only`: exit 0 after adding the compatible override and pin.
- `npm install`: exit 0; removed the stale nested PostCSS package locally.
- `npm explain postcss`: exit 0; `next@15.5.20` now uses overridden `postcss@8.5.16`; no nested `next/node_modules/postcss` package remains.
- `npm ci`: exit 124 locally after timeout; left `node_modules/next` partially installed because existing local Node/Playwright/dev-server processes held workspace files. This was not counted as CI-install evidence.
- Stale verification processes and the repo-local `npm run dev` process were stopped to release Windows file locks.
- `npm install` after cleanup: exit 0 in about 5 minutes; restored a valid local dependency tree.
- `npm ls next postcss --depth=1`: exit 0; `next@15.5.20` uses deduped `postcss@8.5.16`.
- `npm audit --omit=dev --audit-level=low`: exit 0; found 0 production vulnerabilities.
- `npm audit --audit-level=low`: exit 1; 5 remaining dev-only findings through Vitest/Vite/esbuild. Deferred to the development dependency audit policy/remediation work unit; `npm audit fix --force` would be a breaking Vitest major upgrade.
- `npm run typecheck`: exit 0.
- `npm run lint`: exit 0; no warnings/errors. Note: `next lint` deprecation warning.
- `npm run test:coverage`: exit 0; 35 files and 205 tests passed. Statements 65.69% (6761/10292), branches 79.45% (1377/1733), functions 83.79% (243/290), lines 65.69%.
- `npm run build`: exit 0; Next.js 15.5.20 production build passed. First-load JS: landing 566 kB, report 561 kB, share 564 kB, shared 103 kB. Browser data warning: `caniuse-lite` six months old.
- `npx playwright test e2e/accessibility.spec.ts --project=chromium`: exit 124 twice; command timed out without test results because the configured Playwright web server rebuilds before startup and did not complete within local command limits. Not counted as passed.
- Direct production-server smoke: exit 0; `npm.cmd run start` on `PORT=3137` served `/` with HTTP 200 and `RepoAtlas` content, length 30151.
- Post-repair `npm run build`: exit 0; Next.js 15.5.20 production build passed. First-load JS unchanged: landing 566 kB, report 561 kB, share 564 kB, shared 103 kB. Browser data warning: `caniuse-lite` six months old.
- `git diff --check`: exit 1 with CRLF trailing-whitespace warnings on package JSON additions when files use repository-native CRLF under `core.autocrlf=true`; normalizing to LF made the warning disappear but caused unacceptable whole-file line-ending churn, so package files were restored to scoped CRLF diffs.

No runtime code, API behavior, analyzer behavior, report schema behavior, frontend rendering logic, or deployment configuration changed. No representative analyzer performance fixture was measured.

## Publication results (2026-07-12)

- Branch: `agent/postcss-production-audit`.
- Commit before merge: `a898c957a6c0b8f75675ef4221a8bd49bca984df`.
- Pull request: `https://github.com/ChimdumebiNebolisa/RepoAtlas/pull/26`; opened as draft, labeled `codex`, marked ready after checks passed, then squash-merged.
- Merge commit on `main`: `8aff7948b01bcd6fff9708b9e23fe6ead66d6485`.
- GitHub PR checks before merge: `test` passed, `e2e` passed, GitGuardian passed, Vercel preview passed. `codex-automation` label was unavailable; only `codex` existed.
- GitHub main CI after merge: run `29203007031` passed. `test` passed in 1m24s and included Linux `npm ci`, lint, typecheck, coverage, and build. `e2e` passed in 2m57s with 74 tests. GitHub emitted Node.js 20 deprecation annotations for actions, but no job failed.
- Vercel production deployment: `dpl_852Mx9QzZDBovV9ez6Q2QgJxqUb3`, target `production`, state `READY`, commit `8aff7948b01bcd6fff9708b9e23fe6ead66d6485`, URL `https://repo-atlas-72wwehoei-chimdumebinebolisagmailcoms-projects.vercel.app`, inspector `https://vercel.com/chimdumebinebolisagmailcoms-projects/repo-atlas/852Mx9QzZDBovV9ez6Q2QgJxqUb3`.

## Security, schema, performance, and architecture decisions

- Security finding: production dependency audit is clean after pinning and overriding PostCSS to `8.5.16`; keep the override until the installed Next line declares a patched PostCSS dependency directly.
- Security finding: development dependency audit still reports Vitest/Vite/esbuild advisories. Remediation must be a separate compatibility unit, not `npm audit fix --force`.
- Security finding: the adversarial ZIP suite currently covers only a subset of the full contract; remaining path/metadata/collision/cancellation families stay incomplete.
- Report-schema decision: current writes use version 2; runtime validation rejects future versions. Previous-version fixtures, migration semantics, incompatible-report UI, and export compatibility remain open.
- Architecture decision: preserve the existing in-process deterministic analyzer and filesystem/Vercel Blob adapters; no database, private-repository auth, or AI analysis is justified.
- Performance baseline: production first-load JS is 566 kB landing, 561 kB report, 564 kB share. These are observations, not budgets.
- Coverage risk: `app/api/analyze` branch coverage is 46.87%; share routes and much of the frontend have little/no unit coverage despite browser coverage.
- CI decision: the E2E job installs Chromium and WebKit explicitly because the configured Desktop Chrome and iPhone 13 projects require those two engines.

## Repository history and stale work

- Current source of truth: `main` at start-of-run commit `a050c2a`.
- PR #22 is merged and contains the ingestion/document hardening that must not be reapplied.
- PR #24 is open against the already-merged feature branch rather than `main`; treat it as stale evidence only and compare every idea with current `main`.
- PR #23 is open against `main` for cloud environment setup; it is unrelated to product hardening and was not changed.
- Numerous remote `codex/*` and `cursor/*` branches remain. They were inventoried but not modified, closed, or deleted.

## Deferred items, unsupported cases, and deployment uncertainty

- Deferred to ordered phases: full ZIP adversarial matrix; end-to-end request budgets; distributed abuse control; fixture corpus expansion; analyzer correctness changes; schema migrations; adapter equivalence; export sanitization; large-report UX; bundle budgets; observability; final docs reconciliation.
- Unsupported analyzer cases remain explicit for layouts outside the current TS/JS, Python, and Java heuristics, including unproven workspace/alias/import variants listed in the roadmap. No correctness claim was added.
- Vercel production Blob credentials, cleanup secret/schedule, deployment request limits, live required checks, and production observability were not verified in this run.

## Commands executed

See the dated verification section for commands, results, totals, warnings, audit findings, coverage, and bundle measurements. GitHub inspection also used `git remote -v`, `git branch -a`, `gh auth status`, and `gh pr list --state all --limit 30 ...`; authentication was available and PR/branch state was recorded above.

## Development hardening verification and publication (2026-07-12)

- `npm install --ignore-scripts`: exit 0; dependency tree synchronized, npm reported 0 vulnerabilities.
- `npm ls vitest @vitest/coverage-v8 vite vite-node esbuild --depth=3`: exit 0; Vitest 3.2.6, coverage 3.2.6, Vite 6.4.3, vite-node 3.2.4, and esbuild 0.25.12 resolved without invalid or duplicate vulnerable versions.
- `npm audit --audit-level=low`: exit 0; 0 vulnerabilities.
- `npm audit --omit=dev --audit-level=low`: exit 0; 0 production vulnerabilities.
- `npx vitest run src/lib/evidenceIndex.test.ts src/lib/elkLayout.test.ts --coverage=false`: exit 0; 2 files and 4 tests passed.
- `npm run test:coverage`: exit 0; 37 files and 209 tests passed. Statements/lines 63.29% (5292/8361), branches 79.36% (1400/1764), functions 85.56% (249/291). The 63% statements/lines threshold remains unchanged.
- `npm run typecheck`: exit 0.
- `npm run lint`: exit 0; no ESLint warnings/errors. Existing `next lint` deprecation warning remains.
- `npm run build`: exit 0; Next.js 15.5.20 production build passed. First-load JS remained 566 kB landing, 561 kB report, 564 kB share, and 103 kB shared. Existing six-month `caniuse-lite` warning remains.
- `npm run test:e2e`: exit 124 after six minutes locally without test output; this is an environment/startup limitation and is not counted as a local pass. GitHub E2E is the authoritative browser result for this publication.
- `git diff --check`: exit 1 because Git treats repository-native CRLF line endings as trailing whitespace in changed lines; no semantic whitespace was introduced.

Publication evidence:

- Dependency chunk commit: `cc58ac13a8012f72fffbf69025f8a4f61b616ba7`.
- Test/documentation chunk commit: `d406d58ab5892c5a867c5041b8686ba7cd9e1ddb`.
- Branch pushed: `agent/vitest-dev-audit`.
- Pull request: `https://github.com/ChimdumebiNebolisa/RepoAtlas/pull/27`, labeled `codex`, marked ready, and squash-merged.
- GitHub required run `29207411270`: `test` passed in 1m24s, `e2e` passed in 2m28s, GitGuardian passed, Vercel preview passed, and Vercel passed.
- Merge commit: `bfebc85119885e3547be43a7da2f3398014e1c04`.
- Vercel production deployment for the merge commit: `dpl_9JuHVCLVC6YBxfjjPop1uQ7YuviK`, state `READY`, URL `https://repo-atlas-rarr4bph8-chimdumebinebolisagmailcoms-projects.vercel.app`.
- The local Vercel CLI had no credentials; deployment completed through the repository's linked Vercel Git integration.
