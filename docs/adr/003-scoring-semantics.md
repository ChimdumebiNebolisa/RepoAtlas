# ADR 003: Scoring semantics (Start Here and Danger Zones)

**Status:** Accepted  
**Date:** 2026-07-10

## Context

Start Here and Danger Zones must be deterministic, explainable, and honest. Users treat Danger Zones as interview prep for structural risk — not as vulnerability or bug counts.

## Decision

### Start Here

- Candidates are scored from measurable signals (root README, key docs, entrypoints, fan-in, configs).
- Raw scores are **min–max normalized to 0–100** within the repository so the top item is always interpretable relative to peers.
- Explanations are derived from the signals that contributed (`src/analyzer/scoring.ts`).

### Danger Zones

- **Test files are excluded** from production risk ranking. They are not production surface area and would skew percentile baselines.
- Each metric is converted to a **percentile rank (0–100)** within the repo before weighting.
- **Without churn data** (typical zip-only upload):

  ```
  risk = 0.20×size + 0.25×fan_in + 0.20×fan_out + 0.25×complexity + 0.10×weak_test
  ```

- **With churn** (`commit_insights.mode` is `local_git` or `github_api` and churn values exist):

  ```
  risk = 0.18×size + 0.22×fan_in + 0.18×fan_out + 0.22×complexity + 0.10×weak_test + 0.10×churn
  ```

  where `weak_test = 100 − test_proximity_percentile`.

- Breakdown strings show percentile and raw values (e.g. `fan-in p85 (12)`), plus plain-language notes when test proximity is low.
- Results are capped at `MAX_DANGER_ZONE_ITEMS` (200) stored in the report.

### What we do not claim

Danger zones reflect structural signals (size, coupling, complexity, test proximity, optional churn). They do **not** assert defects, security issues, or production readiness. Percentile weights are manually chosen for intra-repo ranking; scores are not calibrated absolute risk.

## Consequences

- Marketing and UI copy must not imply bug counts or SAST results.
- Formula or weight changes require spec/ADR updates and regression tests in `src/analyzer/scoring.test.ts`.

## References

- `src/analyzer/scoring.ts`
- [docs/spec.md](../spec.md) §6
