# RepoAtlas Roadmap

This document contains active future work only. Shipped changes belong in
[CHANGELOG.md](../CHANGELOG.md), current behavior in [spec.md](./spec.md), and
durable decisions in [adr/](./adr/).

## Product direction

RepoAtlas produces deterministic, evidence-backed Candidate Briefs from static
repository signals. The product should deepen evidence, analyzer accuracy, and
platform safety without executing repository code or introducing AI-generated
analysis.

## Now

### Analyzer trust

| Priority | Goal | Key files |
| --- | --- | --- |
| **Evaluation gold set** | Expand human-labeled fixtures and measure entrypoint, relationship, command, and ranking agreement | `eval/`, `src/analyzer/eval/` |
| **Python and Java semantic depth** | Narrow the evidence-depth gap with the TypeScript/JavaScript Compiler API pack | `src/analyzer/packs/` |
| **Small-repository calibration** | Stabilize structural-hotspot rankings for repositories with very few scored files | `src/analyzer/scoring/` |
| **End-to-end cancellation** | Propagate one cancellation signal through acquisition, extraction, indexing, and persistence | `src/app/api/analyze/route.ts`, `src/lib/ingest.ts`, `src/analyzer/index.ts` |

### Evidence and output integrity

| Priority | Goal | Key files |
| --- | --- | --- |
| **Source-file snippets** | Add bounded excerpts to architecture and structural-hotspot evidence | `src/analyzer/snippets.ts`, `src/types/report.ts` |
| **Markdown sanitization** | Escape untrusted repository strings according to Markdown context | `src/lib/export.ts` |
| **Technical-decision evidence** | Populate evidence references on detected decisions | `src/analyzer/decisions.ts` |
| **Richer commit insights** | Add bounded co-change and message-theme evidence without overstating intent | `src/analyzer/gitHistory.ts` |

### Verification and frontend scale

| Priority | Goal |
| --- | --- |
| **Component coverage** | Add behavior-focused tests before raising global coverage thresholds |
| **Snapshot stability** | Normalize volatile fields in Candidate Brief golden tests |
| **Large-report budgets** | Establish measured rendering and export budgets before increasing report size |
| **Client bundle budget** | Lazy-load export dependencies and prevent unmeasured homepage growth |
| **Operational metrics** | Add privacy-safe service metrics without logging repository content |

## Next

### Analyzer depth

- Build a combined reduced architecture for repositories containing multiple
  supported languages.
- Improve framework and test-tool detection using manifests and lockfiles.
- Extend branch-aligned history with bounded co-change evidence.
- Define compatible migrations for older stored reports beyond validate-or-reject.

### Storage and export

- Verify filesystem and Blob retention behavior against the same adapter tests.
- Review private Blob access for stored reports and share-token records.
- Evaluate a structured vector PDF path after current raster export budgets are
  measured.

## Later / exploratory

| Area | Direction |
| --- | --- |
| Progressive results | Stream real analyzer checkpoints only after cancellation and persistence semantics are defined |
| Private repositories | Require user-scoped OAuth and a new access model; never reuse a server-owned token |
| Folder-map filtering | Hide generated and binary paths in the UI without hiding analysis skips |
| Attribute overrides | Consider `.gitattributes` only after deterministic pack-selection rules are defined |

## Explicit non-goals

- LLM-generated analysis or external AI calls
- Executing or profiling repository code
- Full SAST or vulnerability scanning
- Public report deletion without an ownership model
- Caller-controlled filesystem paths on the network API
- Claims of confirmed bugs, correctness, production readiness, business
  purpose, or dynamic runtime behavior

## Work-selection guidance

1. Start with the first incomplete item in **Now** unless a verified production
   incident changes priority.
2. Check [CHANGELOG.md](../CHANGELOG.md) and current source before assuming work
   is unimplemented.
3. Update [spec.md](./spec.md) with behavioral, limit, schema, storage, or API
   changes.
4. Add or amend an ADR for durable security or architecture decisions.
5. Keep one boundary family or behavior change per pull request and run the
   narrowest relevant tests plus required repository checks.

## Related documents

| Document | Responsibility |
| --- | --- |
| [README.md](../README.md) | Product overview, quick start, limits, and developer entry points |
| [CHANGELOG.md](../CHANGELOG.md) | Shipped release history |
| [spec.md](./spec.md) | Current product and behavioral contract |
| [guardrails.md](./guardrails.md) | Non-negotiable implementation constraints |
| [SECURITY.md](../SECURITY.md) | Vulnerability reporting and security guarantees |
| [adr/](./adr/) | Durable architecture decisions and rationale |

*Last updated: 2026-07-29*
