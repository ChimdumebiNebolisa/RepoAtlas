/**
 * Shared report-storage capability detection.
 *
 * Vercel Blob supports either a legacy static read-write token or the
 * short-lived OIDC credentials injected for a connected private Blob store.
 */

export function hasBlobStorageCredentials(): boolean {
  if (process.env.BLOB_READ_WRITE_TOKEN) return true;

  return Boolean(process.env.VERCEL_OIDC_TOKEN && process.env.BLOB_STORE_ID);
}

export function getStaticBlobToken(): string | undefined {
  return process.env.BLOB_READ_WRITE_TOKEN;
}

export function isVercelRuntime(): boolean {
  return process.env.VERCEL === "1";
}

export function canPersistReports(): boolean {
  return !isVercelRuntime() || hasBlobStorageCredentials();
}
