# Adversarial Audit — current `main` (follow-up to 2026-08-22)

- **Status:** AUDIT COMPLETE WITH LIMITATIONS
- **Baseline:** `origin/main` @ `0676979` ("feat: publish Click candidate brief example (#285)")
- **Branch:** `audit/main-remediation-2026-08`
- **Prior pass:** `docs/audits/2026-08-22-adversarial-audit.md` (branch `codex/audit-remediation-2026-07-29`; its three remediation commits were cherry-picked onto this branch: analyzer parity/semicolons/cancellation, e2e realignment subset, docs)

## 1. New evidence: analyzer against unfamiliar real repositories

Downloaded release archives (codeload, no API quota), extracted through RepoAtlas's own hardened extractor, analyzed inline:

| Repository | Files | Profile | Accuracy assessment |
|---|---|---|---|
| `pallets/click` 8.1.7 (Python) | 146 | undefined (correct for this tag — setup.py-era, no pyproject classifier signal; documented depth limit) | Danger top-5 exactly right (`src/click/core.py` #1 — genuinely the largest, most-coupled module). Reading path initially wrong (see F-M1). |
| `google/gson` gson-parent-2.10.1 (Java) | 264 | java-maven-gradle / medium | Danger top-5 exactly the real hotspots (`Gson.java`, `GsonBuilder`, `TypeAdapters`, `JsonReader`). Commands correct (`mvn test/package`). Multiple-`main()` warning honest. Reading path initially wrong (F-M1). |
| `colinhacks/zod` v3.22.4 (TS) | 216 | library / medium | `src/index.ts` correctly first; semantic stats sane (264 internal / 74 external / 55 unresolved, unresolved not inflating fan-in). Generated mirror `deno/lib/` double-counts danger zones (F-M3). |

Manual ground-truth checks confirmed danger-zone ordering matches known architecture for all three repos; entrypoint/evidence claims sampled and verified against extracted sources.

## 2. Findings on current main

| ID | Sev/Pri | Finding | Status |
|---|---|---|---|
| F-M1 | High/P1 | Root README does not dominate Start Here when nested READMEs exist: every `README*` scored a flat 95 regardless of depth, so lexicographic tie-break put `examples/…` ahead of root README on gson AND click reading paths. Violates docs' own canonicalization philosophy (root beats nested). | **Fixed**: depth-aware penalty in `scoring/startHere.ts`; regression test + real-repo re-run (gson root README now #1 score 100). |
| F-M2 | Medium/P2 | README shell commands prefixed with `$`/`>` (Click convention) matched no tool prefix → zero run commands extracted for click. | **Fixed**: prompt-prefix stripping in `commands/index.ts`; regression test. |
| F-M3 | Medium/P2 | Generated mirrors (zod `deno/lib/` duplicating `src/`) are analyzed as independent files, double-counting danger zones and edges. A principled generated-content policy is needed before adding ignore entries ad hoc (misclassifying real source would violate analyzer honesty). | **Documented limitation** + roadmap item; deliberately not regex-expanded. |
| F-M4 | Low/P3 | Library repos can still rank example CLIs above package entrypoints (click's `examples/**/cli.py` beat `README.rst` pre-F-M1 fix; post-fix gap narrowed but examples remain high via entrypoint-name bonuses). Needs deeper Python entrypoint modeling (fan-in credit for `__init__.py`, example-path demotion). | Documented; roadmap. |
| F-M5 | Low/P3 | `setup.py`-only Python projects get no project profile (click tag 8.1.7 → "Unknown"). Correct per current classifier contract; noted as depth gap. | Documented. |
| Carried from prior pass | P1 | Stale e2e sample CTA persisted on main (`helpers.ts` clicked `/Generate the bundled sample brief/i`; hero now reads "See the sample Candidate Brief") — primary cause of red CI e2e on main. | **Fixed**. Cron e2e reconciled: server always runs with a test secret, so specs now assert 401-unauthenticated plus an authenticated successful sweep (fail-closed 503 remains covered by unit tests). |

Framework classification (`projectType.ts`) audited: Django requires `manage.py` with `execute_from_command_line`; Next.js needs app-router pages or dependency; FastAPI requires pyproject mention; Spring Boot requires the annotation in source — all evidence-gated with confidence labels. No defect found. Flask classification absence noted as depth gap.

## 3. Verification (this branch)

See CHANGELOG [Unreleased] and commit history; summary:
- Unit/integration: full `npm test` green after fixes (incl. new regressions).
- Eval floors: green (fixtures unaffected by depth penalty; single-README fixtures).
- Real-repo probes recorded in §1 with before/after for F-M1.
- Typecheck/lint/build: green.
- E2E: production server on :3100 with env contract; targeted suites covering the fixed flows.
- Deployed-worker verification: `runIsolatedAnalysis` exercised outside Vitest so the `worker_threads` path (not the inline fallback) executes.
