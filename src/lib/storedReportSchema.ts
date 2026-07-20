/**
 * Versioned serialization boundary for persisted reports.
 *
 * The storage schema is intentionally separate from `report_version`, which
 * describes analyzer output. This wrapper can evolve without changing the
 * report JSON returned by API, export, and share consumers.
 */

import type { Report } from "@/types/report";
import { validateReport, type ReportLoadResult } from "@/lib/reportSchema";

export const STORED_REPORT_SCHEMA_VERSION = 1;

interface StoredReportV1 {
  storage_schema_version: typeof STORED_REPORT_SCHEMA_VERSION;
  report: Report;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === "object" && !Array.isArray(value);
}

function isVersionedStoredReport(
  value: Record<string, unknown>
): value is Record<string, unknown> & { storage_schema_version: unknown } {
  return Object.prototype.hasOwnProperty.call(value, "storage_schema_version");
}

function migrateUnversionedReport(value: unknown): ReportLoadResult {
  // Reports saved before storage schema versioning were written as the raw
  // customer-facing Report object. Validation is the deterministic V0 -> V1
  // migration: accepted legacy data is returned through today's Report shape.
  return validateReport(value);
}

/** Serialize a report using the current persisted-record schema. */
export function serializeStoredReport(report: Report): string {
  const validated = validateReport(report);
  if (!validated.ok) {
    throw new Error("Cannot store an invalid report.");
  }

  const stored: StoredReportV1 = {
    storage_schema_version: STORED_REPORT_SCHEMA_VERSION,
    report: validated.report,
  };
  return JSON.stringify(stored, null, 2);
}

/** Parse a current stored record or migrate a valid legacy raw report. */
export function parseStoredReport(text: string): ReportLoadResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { ok: false, reason: "corrupt" };
  }

  if (!isObject(parsed)) return { ok: false, reason: "corrupt" };
  if (!isVersionedStoredReport(parsed)) return migrateUnversionedReport(parsed);

  const version = parsed.storage_schema_version;
  if (!Number.isInteger(version) || typeof version !== "number" || version < 1) {
    return { ok: false, reason: "corrupt" };
  }
  if (version !== STORED_REPORT_SCHEMA_VERSION) {
    return { ok: false, reason: "incompatible" };
  }

  return validateReport(parsed.report);
}
