/**
 * Runtime validation for stored report JSON.
 */

import type { Report } from "@/types/report";
import { REPORT_VERSION } from "@/types/report";

export type ReportLoadResult =
  | { ok: true; report: Report }
  | { ok: false; reason: "corrupt" | "incompatible" };

function isObject(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === "object" && !Array.isArray(value);
}

function isRepoMetadata(value: unknown): boolean {
  if (!isObject(value)) return false;
  return (
    typeof value.name === "string" &&
    typeof value.url === "string" &&
    typeof value.branch === "string" &&
    (value.clone_hash === null || typeof value.clone_hash === "string") &&
    typeof value.analyzed_at === "string"
  );
}

function isFolderMapNode(value: unknown): boolean {
  if (!isObject(value)) return false;
  if (typeof value.path !== "string" || (value.type !== "file" && value.type !== "dir")) {
    return false;
  }
  if (value.children != null) {
    if (!Array.isArray(value.children)) return false;
    if (!value.children.every(isFolderMapNode)) return false;
  }
  return true;
}

/** Validate parsed JSON as a supported Report. */
export function validateReport(data: unknown): ReportLoadResult {
  if (!isObject(data)) return { ok: false, reason: "corrupt" };

  const version = data.report_version;
  if (version != null && typeof version === "number" && version > REPORT_VERSION) {
    return { ok: false, reason: "incompatible" };
  }

  if (!isRepoMetadata(data.repo_metadata)) return { ok: false, reason: "corrupt" };
  if (!isFolderMapNode(data.folder_map)) return { ok: false, reason: "corrupt" };
  if (!Array.isArray(data.start_here)) return { ok: false, reason: "corrupt" };
  if (!Array.isArray(data.danger_zones)) return { ok: false, reason: "corrupt" };
  if (!Array.isArray(data.run_commands)) return { ok: false, reason: "corrupt" };
  if (!isObject(data.contribute_signals)) return { ok: false, reason: "corrupt" };
  if (!Array.isArray(data.warnings)) return { ok: false, reason: "corrupt" };

  if (!isObject(data.architecture)) return { ok: false, reason: "corrupt" };
  if (!Array.isArray(data.architecture.nodes) || !Array.isArray(data.architecture.edges)) {
    return { ok: false, reason: "corrupt" };
  }

  return { ok: true, report: data as unknown as Report };
}

export function parseAndValidateReport(text: string): ReportLoadResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { ok: false, reason: "corrupt" };
  }
  return validateReport(parsed);
}
