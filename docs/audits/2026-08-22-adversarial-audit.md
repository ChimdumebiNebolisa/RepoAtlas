# Adversarial Audit — RepoAtlas

- **Status:** AUDIT COMPLETE WITH LIMITATIONS
- **Date:** 2026-08-22
- **Auditor:** ox-alpha (automated adversarial audit per `ADVERSARIAL_CODEBASE_AUDIT_PROTOCOL.md`, read from `C:\Users\Chimdumebi\Desktop\ADVERSARIAL_CODEBASE_AUDIT_PROTOCOL.md`)

## 1. Baseline (preserved state)

| Field | Value |
|---|---|
| Repository | ChimdumebiNebolisa/RepoAtlas |
| Local path | `C:\Users\Chimdumebi\RepoAtlas` |
| Branch | `codex/audit-remediation-2026-07-29` (10 commits ahead of origin) |
| Baseline commit | `ec4d5e3e8d3b072f71d0359209e749f1a88bc51f` |
| Working tree | Clean except untracked `.playwright-cli/` |
| Toolchain | Node v24.14.1, npm 11.11.0, Windows 10.0.26200 X64, PowerShell 5.1 |

Protocol conflict recorded: the prompt states the protocol file was added to the repository root; it was not present in the repo (Desktop copy used). No submodules/LFS; not a shallow clone.

## 2. Verification results at baseline

| Check | Command | Result | Notes |
|---|---|---|---|
| Typecheck | `npm run typecheck` | Pass | clean |
| Lint | `npm run lint` | Pass | ~5 min runtime on this machine |
| Unit/integration | `npm test` | **2 failed / 1347 passed** | both failures are 5s-default-timeout timeouts in `reports-api.integration.test.ts`; pass standalone (17.6s) — F-005 |
| Eval | `npx vitest run src/analyzer/eval/eval.test.ts` | Pass (7 fixtures) | floors met |
| Build | `npm run build` | Pass | bundle budgets pass; runs `next build --webpack` via `scripts/check-build-output.mjs` |
| E2E | external prod server on :3100 + full Playwright matrix | **128 passed / 48 failed / 18 did not run (31.7 min)** | failure clusters below |
| Live CI (GitHub API) | `actions/runs?per_page=6` on main @ `0676979` | **CI e2e job = failure** (test, windows-unit, mobile-native-share pass) | corroborates local e2e failures |

E2E failures share two root causes: (a) stale e2e selectors/copy after recent landing-page changes (F-004), and (b) cron-cleanup tests incompatible with the production fail-closed default (F-003). The identical failure set in chromium and mobile projects confirms systematic causes rather than flakiness. Machine constraint recorded: Playwright's built-in webServer timeout (180s) is shorter than this machine's build time (~5 min); e2e was run against an externally started `next start -p 3100` with the same env contract (`REPORTS_DIR=.playwright-reports`, `ANALYZE_RATE_LIMIT_PER_MIN=0`).

## 3. Findings summary

| ID | Sev | Pri | Conf | Category | Title | Status |
|---|---|---|---|---|---|---|
| F-001 | Medium | P1 | High | Correctness | Python import scanner mishandles semicolon-chained imports | Verified (probe) |
| F-002 | Medium | P1 | High | Correctness/Calibration | Cross-language complexity definitions differ; pooled Danger-Zone percentiles biased; docs claim parity | Verified (probe) |
| F-003 | High | P1 | High | Testing/Reliability | Cron-cleanup e2e fails under any production-mode server after b73fc78 fail-closed change; CI e2e red on main | Verified (local + GitHub API) |
| F-004 | High | P1 | High | Product/Testing | Stale e2e helpers/specs after landing-copy change (`Generate sample Candidate Brief` → `Generate sample brief`; intent radio label; JSON-LD description; removed headings) break ~24 tests × 2 projects and cascade 18 skipped tests | Verified (source diff + run log) |
| F-005 | Low | P2 | High | Testing | `reports-api.integration.test.ts` tests exceed Vitest's 5s default with no explicit timeout → suite-order flake | Verified (17.6s standalone vs 5s cap) |
| F-006 | Medium | P2 | High | Reliability/Cancellation | Commit-insight GitHub fetches (up to 1+8 sequential requests, ≤15s+8×10s) ignore the run abort signal; SHA/default-branch resolution also ignores parent signal | Verified (code path) |
| F-007 | Low | P2 | High | Documentation | spec.md §6 Start Here formula stale vs `scoring/startHere.ts`; spec page map missing live routes (`/code-review-interview`, `/codebase-interview-preparation`, `/how-to-walk-through-a-project-in-an-interview`, `/repository-walkthrough-interview`); roadmap lists shipped items (snippets, markdown sanitization, decision evidence) as open | Verified |
| F-008 | Low | P3 | High | Correctness (minor) | Pipeline CI-pattern substring match counts every file under `.github/workflows` (any extension) as a CI config | Verified (code) |

### F-001: Python semicolon-chained imports lost / malformed
- **Evidence:** `src/analyzer/packs/python/extract.ts` `readImportNameList()` treats `;` as ordinary content.
- **Probe:** `extractImportSpecifiers("import os; import sys\n…")` → `["os;"]` (malformed; `sys` dropped). Comments/docstrings/parenthesized multiline imports handled correctly (probes returned `[]` / correct expansion).
- **Impact:** false-negative import edges → understated fan-in/fan-out, missing architecture edges for repos using semicolon style.
- **Fix:** terminate name-list parsing at statement separator `;` and resume scanning; regression test.

### F-002: Complexity proxies not comparable across packs (contradicts spec)
- **Evidence:** TS counts if/for/while/do/catch/ternary/case/&&/||/?? (`tsjsExtract.ts`); Python additionally counts else/try/except-finally-keywords/with/match (`python/signals.ts` COMPLEXITY_RE); Java counts else/switch plus bare `\?` matching generic wildcards (`javaMetrics.ts`). `computeDangerZones()` pools all packs into one percentile ranking.
- **Probe:** equivalent control flow (2×if/else + loop + try/catch/finally) → branchCount TS=3 (score 17), Java=5 (21; one match is the generic wildcard `Map<String, ?>`), Python=6 (24).
- **Spec contradiction:** spec.md §5 says Python/Java use "same as TS" proxy. Runtime authority is the code, not the spec.
- **Impact:** Python/Java files receive systematically inflated complexity percentiles in mixed-language repos; breakdown strings present these as comparable percentiles.
- **Counterargument:** rankings are repository-relative and labeled structural signals, not defect probabilities. Assessment: accepted for cross-repo honesty, but within-repo cross-language comparability is still claimed implicitly by pooling; fix aligns keyword sets and documents residual limits.

### F-003: Cron e2e incompatible with production fail-closed default
- **Evidence:** commit `b73fc78` changed `cronMisconfigured()` to fire when `NODE_ENV=production` (`src/app/api/cron/cleanup/route.ts`); `e2e/api-edge-cases.spec.ts:202,210` expect unauthenticated success; CI e2e job on main failing today (run 32548621540, step "Run the complete browser matrix").
- **Impact:** red CI masks real regressions; retention sweep has no browser-level coverage signal.
- **Fix:** give the e2e webServer a test CRON_SECRET (playwright config env) and send `Authorization: Bearer` in the two tests; keeps fail-closed semantics fully exercised (401 path stays tested by unit tests).

### F-004: Landing-copy change without e2e alignment
- **Evidence:** hero CTA now "Generate sample brief" (`HomepageProofSections.tsx:67`) vs helper `/Generate sample Candidate Brief/i` (`e2e/helpers.ts:81`) → all sample-flow UI tests time out at 120s waiting for the button; intent radio label now "Prepare for an interview" (`inputFormSupport.ts:17`) vs expected `/Interview walkthrough/i` (`input-modes.spec.ts:50`); JSON-LD description updated in `homepageContent.ts:17` but hardcoded old copy in `e2e/structured-data.spec.ts:20`; headings "Start in the right place"/"Your Candidate Brief is ready" no longer exist anywhere in `src/`.
- **Impact:** largest single blocker to trusting the suite; CI main e2e red; 18 tests never ran because workers exhausted retries/timeouts.
- **Remediation:** mechanical selector/copy fixes implemented this pass; interview-preparation guide specs require product-intent rewrites (recorded as limitation).

### F-005/F-006/F-007/F-008
Details as summarized above; evidence inline in section 3 table rows and file references.

## 4. Contradictions table (selected)

| Source A | Source B | Contradiction | Runtime authority |
|---|---|---|---|
| spec.md §6 Start Here weights (40/30/50/min20/15) | `src/analyzer/scoring/startHere.ts` (95/85/75/…) | stale doc | code |
| spec.md §2 page map | actual build route list | 4 live guide pages undocumented | build output |
| spec.md §5 "same as TS" complexity claim | pack implementations | not same (F-002) | code |
| roadmap.md "Now" items | shipped code (`snippets.ts`, export escaping + tests, decision evidence) | stale roadmap | code |
| README "up to 100 MB compressed locally" | `maxCompressedBytesForZipUpload()` | consistent | code |

## 5. Rejected hypotheses (investigated and ruled out)

1. **ZIP traversal/bomb/symlink escape** — plan-then-write with normalized collision preflight, magic-byte validation, entry/per-file/total caps enforced during streaming decompression, rollback on failure, symlinks rejected during walk (`safeZipPlan.ts`, `safeZipWrite.ts`, `pipeline.ts` lstat checks). No exploitable gap found.
2. **Caller-controlled paths** — JSON `zipRef` rejected at the API boundary; report IDs UUID-gated before storage access; snippet/doc/command readers jail to realpath'd workspace and reject symlinked segments.
3. **GitHub SSRF/token leakage** — canonical URL parser, unauthenticated API calls, final-host allowlist after redirects, streaming download with hard size caps and abort wiring. Residual note: intermediate redirect hops are not individually validated (final host only); initial URL is server-constructed so attacker control of the chain would require github.com compromise — Informational.
4. **Markdown/HTML injection in exports and share views** — systematic escaping (`export.ts`), no `dangerouslySetInnerHTML` except escaped JSON-LD (`serializeJsonLd` replaces `<`), `marked` used only in tests to assert no raw HTML passes through.
5. **Non-determinism in outputs** — deterministic sorts throughout (key docs, folder map, semantic graph nodes/edges/warnings, danger-zone tie-break by path, Start Here tie-break by path); `analyzed_at` is documented presentation metadata.
6. **Evidence-reference integrity** — evidence index IDs generated from bounded prefixes with collision guards for decision refs; snippets bounded (≤300 chars/5 lines) with secret-path refusal; unresolved edges cannot inflate fan-in/fan-out or architecture.

## 6. Coverage ledger (critical paths)

| Path | Depth | Status |
|---|---|---|
| `src/lib/safeZip*.ts`, `ingest*.ts`, `github.ts` | Full read + design trace | Fully inspected |
| `src/analyzer/index.ts`, `pipeline.ts`, `languagePacks.ts`, `reportAssembly.ts`, `reportPersistence.ts`, `analysisDeadline.ts`, `runIsolatedAnalysis.ts`, `scripts/analysis-worker.cjs` | Full read | Fully inspected |
| `src/analyzer/packs/tsjs*` | Full read (extract/resolve/entrypoints coordinator) | Fully inspected |
| `src/analyzer/packs/python*`, `java*` | Full read of import/complexity/entrypoint paths; module discovery skimmed | Partially inspected (javaModules/javaSources read via call sites) |
| `src/analyzer/scoring/*`, `semanticGraph.ts`, `docs.ts`, `snippets.ts`, `decisions.ts`, `gitHistory.ts` | Full read | Fully inspected |
| `src/analyzer/interview/**` | Evidence/confidence/index read; walkthrough/summary generators spot-checked | Partially inspected |
| `src/app/api/**` | analyze + cron read fully; reports/share/export verified via tests + route table cross-check | Dynamically exercised |
| `src/lib/storage.ts`, `sharing/**`, `reportTtl`, `storedReportSchema` | Full read | Fully inspected |
| Components (76 files) | Structure reviewed; graph/export/share hooks spot-checked; unit tests relied on | Partially inspected |
| `e2e/**`, `playwright.config.ts`, CI workflows | Full read | Fully inspected |
| `eval/**`, gold labels | Full read | Fully inspected |
| `public/`, `docs/images`, `demo.gif` | Binary/generated | Metadata only |

## 7. Limitations and unknowns

- Interview-preparation/guide e2e specs need rewrites against current IA (headings removed from app); deferred with explicit remediation item — they fail for the F-004 root cause class.
- WebKit-specific behaviors only exercised through this machine's Playwright run; no independent device lab.
- Blob storage path audited by code reading only (no live Vercel credentials locally).
- `analyzeCommitInsights` GitHub-mode behavior under rate limiting returns UNAVAILABLE by design; not exercised against live GitHub in this audit.
- Performance under large real repositories (>10k files) reasoned from caps, not measured here beyond bundle/build budgets.

## 8. Remediation implemented (same branch, after baseline `ec4d5e3`)

| Finding | Fix | Regression test |
|---|---|---|
| F-001 | `python/extract.ts`: statement separator (`;`) ends the import name list; scanner resumes at line-start semantics so chained statements are parsed. | `python.test.ts` "extracts both modules from semicolon-chained import statements" |
| F-002 | Python `COMPLEXITY_RE` no longer counts else/try/finally/with; Java regex no longer counts else/switch keyword and excludes generic wildcards from `\?` via lookarounds. | New `packs/complexityParity.test.ts` (identical control flow → identical branchCount across TS/Python/Java); updated `javaMetrics.test.ts`, `python.test.ts` expectations |
| F-003 | `playwright.config.ts` provides a test-only `CRON_SECRET` to the web server; cron e2e sends the bearer header and asserts the real response contract (`reports`/`shares`). Fail-closed 503 stays covered by unit tests. | e2e `api-edge-cases.spec.ts` cron tests (verified green against a production-mode server) |
| F-004 (mechanical subset) | Helper CTA `/Generate sample Candidate Brief/i → /Generate sample brief/i`; intent radio label; JSON-LD spec derives from `siteIdentity`; homepage sample-proof spec rewritten to assert the current bounded-preview contract. | e2e suites below |
| F-005 | All long API integration tests use Vitest's options-object `{ timeout: 30_000 }`; the trailing numeric form was silently ignored by Vitest 3.2.6 (root cause of the 5000ms failures despite `, 30000)` in source). | full-suite run below (0 failures) |
| F-006 | `analyzeCommitInsights` accepts the run signal (`AbortSignal.any` with per-request timeouts, abort checks between detail fetches); `resolveDefaultBranch`/`resolveCommitSha` accept the parent signal. | `gitHistory.test.ts`: pre-aborted skip + mid-flight abort stops detail loop |
| F-007 | spec.md §6 rewritten to match `startHere.ts`; complexity rows document aligned decision points; guide routes added to page map; roadmap shipped items removed with audit pointer. | n/a (docs) |
| F-008 | Pipeline CI detection requires YAML directly under `.github/workflows`. | `pipeline.test.ts` "does not report non-YAML files under .github/workflows" |

### Verification after remediation

| Check | Command | Before | After |
|---|---|---|---|
| Typecheck | `npm run typecheck` | Pass | Pass |
| Lint | `npm run lint` | Pass | Pass |
| Unit/integration | `npm test` | 1347 pass / **2 fail** | **1358 pass / 0 fail** (146 files) |
| Eval floors | `npx vitest run src/analyzer/eval/eval.test.ts` | 10 pass | **10 pass** — no fixture's floor changed; per-fixture metrics for python/java fixtures shift only where semicolon imports or complexity values affect membership, and all floors still hold (fixtures are single-language, so cross-language pooling does not apply to them) |
| Build + budgets | `npm run build` | Pass | Pass |
| E2E (chromium+mobile, external prod server :3100) | `npx playwright test` | 128 pass / **48 fail** / 18 skipped, 31.7 min | **173 pass / 12 fail / 9 skipped**, 8.4 min |
| Live CI on main (GitHub API read) | e2e job | failure @ `0676979` | unchanged (this branch is ahead of origin; push is out of scope) |

Remaining e2e failures after remediation (all documented): 10× interview-preparation/guide specs whose expected headings were removed in the landing redesign and require product-intent rewrites (now tracked as the top roadmap item), plus mobile-only timeout stragglers of the same flows on this machine.

Analyzer before/after evidence: probes recorded in §3 (F-001 `["os;"]` vs `["os","sys"]`; F-002 TS 17 / Java 21 / Python 24 vs identical branchCount=3 post-fix). No gold-label expectation changed; no fixture result regressed its floor.

