/**
 * Centralized ingestion limits.
 *
 * Single source of truth for every size/count/timeout budget used across the
 * API route, the ZIP extractor, the GitHub archive downloader, and the UI. This
 * prevents the API, extractor, documentation discovery, and UI from disagreeing
 * about what "too large" means (Phase 1 finding D / Phase 2 requirement 8).
 */

/** Maximum accepted compressed archive size (uploaded zip or downloaded archive). */
export const MAX_COMPRESSED_BYTES = 100 * 1024 * 1024; // 100 MB

/** Maximum cumulative uncompressed size after extraction. */
export const MAX_UNCOMPRESSED_BYTES = 50 * 1024 * 1024; // 50 MB

/** Maximum number of entries inside an archive. */
export const MAX_ENTRIES = 10_000;

/** Maximum uncompressed size of any single file inside an archive. */
export const MAX_SINGLE_FILE_BYTES = 10 * 1024 * 1024; // 10 MB

/** Maximum number of files the indexing pipeline will record. */
export const MAX_FILE_COUNT = 10_000;

/** Maximum folder-map recursion depth. */
export const MAX_DEPTH = 10;

/** Wall-clock budget for the whole analysis run. */
export const MAX_ANALYSIS_TIME_MS = 120_000; // 120 s

/** Timeout for a single GitHub archive download. */
export const DOWNLOAD_TIMEOUT_MS = 60_000; // 60 s

/** Timeout for a single GitHub REST API request (metadata / SHA resolution). */
export const GITHUB_API_TIMEOUT_MS = 15_000; // 15 s

/** Human-friendly megabyte figure for user-facing copy. */
export const MAX_COMPRESSED_MB = Math.round(MAX_COMPRESSED_BYTES / (1024 * 1024));
export const MAX_UNCOMPRESSED_MB = Math.round(MAX_UNCOMPRESSED_BYTES / (1024 * 1024));
