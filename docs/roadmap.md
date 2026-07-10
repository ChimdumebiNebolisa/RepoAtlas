# RepoAtlas Roadmap

Future-facing plan after the 2026-07-10 stabilization pass. Completed work is recorded in [CHANGELOG.md](../CHANGELOG.md). Engineering constraints live in [spec.md](./spec.md) and [guardrails.md](./guardrails.md).

---

## Product direction

RepoAtlas produces **deterministic, evidence-backed Candidate Briefs** from static repository signals — no LLM calls. The core loop is stable:

```
ZIP upload or public GitHub URL → analyze → report id → tabs + export (+ optional share link)
```

Near-term focus: deepen trust (evidence, performance, accessibility), harden platform limits, and extend analyzer accuracy — without changing the no-AI contract.

---

## Current baseline (post-stabilization)

Shipped and enforced as of 2026-07-10:

- Dual input (ZIP + public GitHub URL), deployment-aware ZIP caps, hardened extraction
- Capability-link report access (GET only), share tokens, Markdown export
- Deterministic Candidate Brief, Start Here, Danger Zones (test files excluded from risk ranking)
- Cron TTL sweep with production fail-closed auth; Blob share cleanup parity
- Runtime report JSON validation; `typecheck` + coverage in CI

Details: [CHANGELOG.md](../CHANGELOG.md). ADRs: [001](./adr/001-capability-access.md), [002](./adr/002-zip-limits.md), [003](./adr/003-scoring-semantics.md).

---

## Now (next 1–2 milestones)

### Platform and limits

| Item | Goal | Key files |
|------|------|-----------|
| **AbortSignal end-to-end** | One deadline propagated through download, extract, index, and storage | `src/analyzer/index.ts`, `src/lib/ingest.ts` |
| **Streaming ZIP extraction** | Avoid whole-buffer reads; account bytes during extract | `src/lib/safeZipExtract.ts` |
| **Durable rate limiting** | Replace process-local window with Redis/KV via `setRateLimiter()` | `src/lib/rateLimit.ts` |
| **Report schema migration** | Versioned upgrade path for stored JSON beyond validate-or-reject | `src/lib/reportSchema.ts`, `src/types/report.ts` |

### Evidence and interview content

| Item | Goal | Key files |
|------|------|-----------|
| **Source-file snippets** | Line-bounded excerpts on architecture and danger-zone evidence | `src/analyzer/snippets.ts`, `src/types/report.ts` |
| **Richer commit insights** | `co_changed_pairs`, message themes, evidence refs | `src/analyzer/gitHistory.ts` |
| **Technical decision evidence** | Populate `evidence_refs` on detected decisions | `src/analyzer/decisions.ts` |

### Frontend quality

| Item | Goal | Key files |
|------|------|-----------|
| **Lazy export deps** | Defer html2canvas/jspdf until export; reduce landing bundle | `src/components/ReportTabs.tsx` |
| **Accessibility** | Full keyboard/ARIA tab semantics; axe in E2E | `src/components/ReportTabs.tsx`, `e2e/accessibility.spec.ts` |
| **Markdown export sanitization** | Context-aware escaping of untrusted repo strings | `src/lib/export.ts` |
| **Honest loading UX** | Keep single honest progress indicator until server streams stages (if ever) | `src/components/InputForm.tsx` |

### Testing and CI

| Item | Goal |
|------|------|
| **Raise coverage thresholds** | Component behavior tests with jsdom/Testing Library before bumping global gates |
| **E2E accessibility gate** | Run axe checks on homepage and report tabs in CI |
| **Snapshot stability** | Normalize volatile fields in brief golden tests |

---

## Next (after platform slice)

### Analyzer depth

- **Path alias resolution** — `@/`, tsconfig paths, workspace package imports in TS/JS pack.
- **Combined multi-language architecture** — single graph when monorepo mixes languages.
- **Calibrated small-sample risk** — stable percentiles on tiny repos (fewer than ~5 scored files).
- **Manifest-accurate detection** — framework and test tooling from lockfiles/deps, not filename guesses only.

### Export and sharing

- **Structured PDF** — optional vector/layout PDF instead of raster-only snapshot.
- **Private blob access review** — confirm token-gated reads for all stored artifacts in production.

### Framework maintenance

- Stay current on Next.js security advisories; major upgrades as dedicated, tested PRs.

---

## Later / exploratory

| Area | Notes |
|------|-------|
| **Progressive analysis (SSE)** | Stream partial sections if analyzer checkpoints mature |
| **User-scoped GitHub auth** | Private repos require deliberate OAuth — not a token in `.env` |
| **Clone cache** | Reuse analysis for same `owner/repo@sha` within TTL |
| **Folder map filtering** | Hide binaries/generated dirs in tree while keeping analysis skips |
| **`.gitattributes` overrides** | Language pack selection from attributes |

---

## Explicit non-goals

- LLM-generated brief text or external AI APIs during analysis
- Executing or profiling uploaded repository code
- Full SAST / vulnerability scanning
- Public report deletion without an ownership model
- Caller-controlled `zipRef` on the network API

---

## How to propose work

1. Check [CHANGELOG.md](../CHANGELOG.md) so the item is not already shipped.
2. If behavior, limits, or API change: update [spec.md](./spec.md) in the same PR.
3. For security-sensitive decisions: add or extend an ADR under [docs/adr/](./adr/).
4. Prefer small PRs with `npm run typecheck`, `npm run test`, and relevant E2E green.

---

## Priority guidance

When choosing what to build next:

1. **Security and correctness** before new brief templates (limits, validation, sanitization).
2. **Evidence depth** before marketing claims (snippets, commit refs, decision evidence).
3. **Platform honesty** before UX polish (deployment limits must match UI and API).
4. **One PR per concern** — e.g. do not mix Next.js upgrades with scoring changes.

Large items (Next.js major upgrades, OAuth for private GitHub) deserve dedicated branches with full `typecheck`, `test`, `test:coverage`, and `test:e2e` green.

---

## Related documents

| Doc | Purpose |
|-----|---------|
| [spec.md](./spec.md) | Canonical engineering specification |
| [guardrails.md](./guardrails.md) | Non-negotiable implementation rules |
| [CHANGELOG.md](../CHANGELOG.md) | Shipped changes (incl. stabilization pass) |
| [SECURITY.md](../SECURITY.md) | Vulnerability reporting and security model |
| [adr/](./adr/) | Architecture decision records |

*Last updated: 2026-07-10*
