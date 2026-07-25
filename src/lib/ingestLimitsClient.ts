/**
 * Client-safe ingestion limit constants for UI validation copy.
 * Mirrors server caps without importing Node-only modules.
 */

/** Vercel deployed ZIP cap (4 MB). Local dev may accept larger uploads server-side. */
export const CLIENT_MAX_ZIP_MB_VERCEL = 4;

export const CLIENT_MAX_UNCOMPRESSED_MB = 50;

const CLIENT_MAX_ZIP_BYTES = CLIENT_MAX_ZIP_MB_VERCEL * 1024 * 1024;

/**
 * Keep the browser preflight fixed to the hosted cap in every environment.
 * Server-side tooling may accept larger local archives, but the customer-facing
 * form should not change its promise based on a browser hostname.
 */
export function clientMaxZipBytes(): number {
  return CLIENT_MAX_ZIP_BYTES;
}

export function clientMaxZipMbLabel(): string {
  return String(CLIENT_MAX_ZIP_MB_VERCEL);
}
