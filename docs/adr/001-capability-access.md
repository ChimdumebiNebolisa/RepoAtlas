# ADR 001: Capability-link access (no public delete)

**Status:** Accepted  
**Date:** 2026-07-10

## Context

RepoAtlas has no user accounts or ownership model. Reports are identified by UUIDs returned from `POST /api/analyze`. Anyone who knows a report id can read the stored JSON.

A public `DELETE` endpoint would let an anonymous caller destroy data if they guessed or intercepted an id. That is unacceptable without authentication.

## Decision

1. **Report ids are read-only capabilities.** `GET /api/reports/:id` returns report JSON; there is no public mutation route.
2. **Ids are validated** against a strict UUID shape before any storage access (`src/app/api/reports/[id]/route.ts`).
3. **Retention is server-side.** `deleteReport()` exists only for internal TTL/max-count sweeps invoked by `POST /api/cron/cleanup`.
4. **Responses are never cached.** Report, share, and Markdown export responses use `Cache-Control: no-store`.
5. **Share tokens** are separate, opt-in, 7-day read capabilities; they expose report JSON only, never uploaded zip contents.

## Consequences

- Users cannot manually delete a report via the API; expired reports disappear after the configured TTL.
- Operators must schedule cron cleanup in production and set `CRON_SECRET` (see ADR context in cron route).
- Future private-repo or account features would require a new access model rather than bolting delete onto UUID guessing.

## References

- [SECURITY.md](../../SECURITY.md)
- `src/app/api/reports/[id]/route.ts`
- `src/lib/storage.ts`
