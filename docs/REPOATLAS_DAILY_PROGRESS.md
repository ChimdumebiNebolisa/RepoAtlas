# RepoAtlas Daily Product Hardening Progress

Last updated: 2026-07-11 (America/Chicago)

This file is a persistent evidence record, not a substitute for checking the current default branch. Each run must compare it with source, tests, configuration, and recent history before selecting work.

## Current state

- Current phase: Phase 2 — dependency and platform security.
- Completed work unit: Phase 1 baseline, inventory, and producer-to-consumer map (2026-07-11).
- Current in-progress work unit: none.
- Next incomplete work unit: production dependency baseline/remediation plan for the Next.js-bundled PostCSS advisory.
- Blockers: none. WebKit was initially absent locally and was installed; the complete mobile project then passed.

## Ordered work-unit checklist

- [x] Phase 1: baseline, repository inventory, recent-work verification, stale-branch review, and blast-radius map.
- [ ] Phase 2: production dependency baseline and Next.js upgrade/remediation plan.
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

## Security, schema, performance, and architecture decisions

- Security finding: production dependency audit is not clean. Remediation must be a separate Next.js compatibility unit, not `npm audit fix --force`.
- Security finding: the adversarial ZIP suite currently covers only a subset of the full contract; remaining path/metadata/collision/cancellation families stay incomplete.
- Report-schema decision: current writes use version 2; runtime validation rejects future versions. Previous-version fixtures, migration semantics, incompatible-report UI, and export compatibility remain open.
- Architecture decision: preserve the existing in-process deterministic analyzer and filesystem/Vercel Blob adapters; no database, private-repository auth, or AI analysis is justified.
- Performance baseline: production first-load JS is 566 kB landing, 561 kB report, 564 kB share. These are observations, not budgets.
- Coverage risk: `app/api/analyze` branch coverage is 46.87%; share routes and much of the frontend have little/no unit coverage despite browser coverage.
- CI decision: the E2E job installs Chromium and WebKit explicitly because the configured Desktop Chrome and iPhone 13 projects require those two engines.

## Repository history and stale work

- Current source of truth: `main` at start-of-run commit `235affd`.
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
