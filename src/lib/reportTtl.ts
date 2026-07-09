/**
 * Report retention policy helpers.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

export function getReportTtlDays(): number {
  const raw = process.env.REPORT_TTL_DAYS;
  if (raw) {
    const n = Number(raw);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return process.env.BLOB_READ_WRITE_TOKEN ? 7 : 30;
}

export function getReportMaxCount(): number {
  const raw = process.env.REPORT_MAX_COUNT;
  if (raw) {
    const n = Number(raw);
    if (Number.isFinite(n) && n > 0) return Math.floor(n);
  }
  return 100;
}

export function getReportTtlMs(): number {
  return getReportTtlDays() * DAY_MS;
}

export function getCronSecret(): string | undefined {
  return process.env.CRON_SECRET?.trim() || undefined;
}
