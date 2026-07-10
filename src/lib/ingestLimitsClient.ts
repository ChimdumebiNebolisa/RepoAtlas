/**
 * Client-safe ingestion limit constants for UI validation copy.
 * Mirrors server caps without importing Node-only modules.
 */

/** Vercel deployed ZIP cap (4 MB). Local dev may accept larger uploads server-side. */
export const CLIENT_MAX_ZIP_MB_VERCEL = 4;

/** Local / non-Vercel dev ZIP cap shown when not on Vercel. */
export const CLIENT_MAX_ZIP_MB_LOCAL = 100;

export const CLIENT_MAX_UNCOMPRESSED_MB = 50;

/** Conservative client-side pre-check (use deployed cap in production builds). */
export function clientMaxZipBytes(): number {
  if (typeof window !== "undefined" && window.location.hostname.includes("vercel.app")) {
    return CLIENT_MAX_ZIP_MB_VERCEL * 1024 * 1024;
  }
  // Default to deployed cap so local UI matches production honesty.
  return CLIENT_MAX_ZIP_MB_VERCEL * 1024 * 1024;
}

export function clientMaxZipMbLabel(): string {
  return String(CLIENT_MAX_ZIP_MB_VERCEL);
}
