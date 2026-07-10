/**
 * Centralized ingestion limits.
 *
 * Single source of truth for every size/count/timeout budget used across the
 * API route, the ZIP extractor, the GitHub archive downloader, and the UI.
 */

/** Maximum compressed archive for GitHub downloads and local dev ZIP uploads. */
export const MAX_COMPRESSED_BYTES = 100 * 1024 * 1024; // 100 MB

/**
 * Vercel Function request bodies are capped at ~4.5 MB. ZIP uploads on Vercel
 * must stay safely below that limit; use GitHub URL mode for larger public repos.
 */
export const MAX_DEPLOYED_ZIP_BYTES = 4 * 1024 * 1024; // 4 MB

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

/** Serialized report payload budget (approximate JSON bytes). */
export const MAX_REPORT_JSON_BYTES = 4 * 1024 * 1024; // 4 MB

/** Danger zones included in stored report. */
export const MAX_DANGER_ZONE_ITEMS = 200;

/** Document similarity comparisons budget. */
export const MAX_DOC_COMPARISONS = 500;

export function isVercelDeployment(): boolean {
  return process.env.VERCEL === "1";
}

/** Compressed-byte cap for multipart ZIP uploads (environment-aware). */
export function maxCompressedBytesForZipUpload(): number {
  return isVercelDeployment() ? MAX_DEPLOYED_ZIP_BYTES : MAX_COMPRESSED_BYTES;
}

/** Human-friendly megabyte figures for user-facing copy. */
export function maxZipUploadMb(): number {
  return Math.round(maxCompressedBytesForZipUpload() / (1024 * 1024));
}

export const MAX_COMPRESSED_MB = Math.round(MAX_COMPRESSED_BYTES / (1024 * 1024));
export const MAX_UNCOMPRESSED_MB = Math.round(MAX_UNCOMPRESSED_BYTES / (1024 * 1024));
export const MAX_DEPLOYED_ZIP_MB = Math.round(MAX_DEPLOYED_ZIP_BYTES / (1024 * 1024));
