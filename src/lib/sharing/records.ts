/**
 * Canonical stored-share record validation.
 */

export const SHARES_BLOB_PREFIX = "shares/";
export const SHARE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

const REPORT_ID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export interface ShareRecord {
  reportId: string;
  createdAt: string;
  expiresAt: string;
}

export function isValidShareToken(token: string): boolean {
  return /^[A-Za-z0-9_-]{20,64}$/.test(token);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseCanonicalTimestamp(value: unknown): number | null {
  if (typeof value !== "string") return null;
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return null;
  return new Date(timestamp).toISOString() === value ? timestamp : null;
}

export function parseShareRecord(
  value: unknown,
  now = Date.now()
): ShareRecord | null {
  if (!isPlainObject(value) || typeof value.reportId !== "string") return null;
  if (!REPORT_ID_RE.test(value.reportId)) return null;

  const createdAt = parseCanonicalTimestamp(value.createdAt);
  const expiresAt = parseCanonicalTimestamp(value.expiresAt);
  if (createdAt === null || expiresAt === null) return null;
  if (createdAt > now || expiresAt - createdAt !== SHARE_TTL_MS) return null;

  return {
    reportId: value.reportId,
    createdAt: value.createdAt as string,
    expiresAt: value.expiresAt as string,
  };
}

export function parseShareRecordJson(value: string): ShareRecord | null {
  try {
    return parseShareRecord(JSON.parse(value));
  } catch {
    return null;
  }
}
