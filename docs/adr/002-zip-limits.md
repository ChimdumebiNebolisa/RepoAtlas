# ADR 002: Environment-aware ZIP limits

**Status:** Accepted  
**Date:** 2026-07-10

## Context

Vercel Function request bodies are capped at roughly 4.5 MB. Advertising a 100 MB upload limit on the deployed app would mislead users and fail at the platform layer. Larger public repositories are better served by GitHub URL ingestion, which streams archives server-side.

Zip bombs, path traversal, and oversized uncompressed content remain risks regardless of deployment target.

## Decision

Centralize all ingestion budgets in `src/lib/ingestLimits.ts`:

| Limit | Constant | Value |
|-------|----------|-------|
| ZIP upload (Vercel) | `MAX_DEPLOYED_ZIP_BYTES` | 4 MB |
| ZIP upload (local dev) | `MAX_COMPRESSED_BYTES` | 100 MB |
| GitHub archive download | `MAX_COMPRESSED_BYTES` | 100 MB |
| Uncompressed total | `MAX_UNCOMPRESSED_BYTES` | 50 MB |
| Archive entries | `MAX_ENTRIES` | 10,000 |
| Single file (uncompressed) | `MAX_SINGLE_FILE_BYTES` | 10 MB |

`maxCompressedBytesForZipUpload()` selects the deployment-aware cap (`VERCEL === "1"` → 4 MB). The UI mirrors this via `src/lib/ingestLimitsClient.ts`.

Extraction uses `src/lib/safeZipExtract.ts` (magic bytes, path jail, size/count caps). The public API **rejects** caller-supplied JSON `zipRef`; only server-created temp paths from multipart uploads reach the zip ingest path.

## Consequences

- Deployed users with repos larger than 4 MB should use **Public GitHub URL** mode.
- Local development can still exercise large zip uploads up to 100 MB compressed.
- Docs, API errors, and UI copy must stay aligned with `ingestLimits.ts` — not hardcoded elsewhere.

## References

- `src/lib/ingestLimits.ts`, `src/lib/safeZipExtract.ts`
- `src/app/api/analyze/route.ts`
- [docs/spec.md](../spec.md) §4
