/**
 * Presentation helpers shared by report views. Pure functions only — safe to
 * import into both server and client components.
 */

/** True only for a well-formed http(s) URL. */
export function isHttpUrl(value: string | null | undefined): boolean {
  if (!value) return false;
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * Human-readable label for a repository source. GitHub URL analyses carry a
 * real http(s) URL; ZIP uploads carry the literal sentinel "zip" (which must
 * never be rendered as a `/zip` link).
 */
export function repoSourceLabel(url: string | null | undefined): string {
  if (isHttpUrl(url)) return url as string;
  return "Uploaded ZIP";
}

/**
 * Format an ISO-8601 timestamp for display while preserving a machine-readable
 * value for the caller to place in a `<time dateTime>` attribute. Invalid or
 * empty input is returned unchanged so we never fabricate a date.
 */
export function formatTimestamp(value: string | null | undefined): {
  display: string;
  dateTime: string | null;
} {
  if (!value) return { display: "Unknown", dateTime: null };
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return { display: value, dateTime: null };
  }
  const display = parsed.toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZoneName: "short",
    timeZone: "UTC",
  });
  return { display, dateTime: parsed.toISOString() };
}
