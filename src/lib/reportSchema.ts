/**
 * Runtime validation for stored report JSON.
 */

import type { Report } from "@/types/report";
import { ANALYSIS_INTENTS, REPORT_VERSION } from "@/types/report";

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
  if (
    data.analysis_intent != null &&
    !ANALYSIS_INTENTS.some((intent) => intent === data.analysis_intent)
  ) {
    return { ok: false, reason: "corrupt" };
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

  // Optional semantic_graph must be structurally valid when present.
  if (data.semantic_graph != null) {
    if (!isObject(data.semantic_graph)) return { ok: false, reason: "corrupt" };
    const g = data.semantic_graph;
    if (typeof g.version !== "number") return { ok: false, reason: "corrupt" };
    if (typeof g.language !== "string" || typeof g.adapter !== "string") {
      return { ok: false, reason: "corrupt" };
    }
    if (!Array.isArray(g.nodes) || !Array.isArray(g.edges)) {
      return { ok: false, reason: "corrupt" };
    }
    if (!isObject(g.stats)) return { ok: false, reason: "corrupt" };
    if (!Array.isArray(g.warnings)) return { ok: false, reason: "corrupt" };
    for (const edge of g.edges) {
      if (!isObject(edge)) return { ok: false, reason: "corrupt" };
      if (typeof edge.from !== "string" || typeof edge.specifier !== "string") {
        return { ok: false, reason: "corrupt" };
      }
      if (typeof edge.kind !== "string" || typeof edge.resolution !== "string") {
        return { ok: false, reason: "corrupt" };
      }
      if (!isObject(edge.evidence)) return { ok: false, reason: "corrupt" };
      if (
        typeof edge.evidence.path !== "string" ||
        typeof edge.evidence.line_start !== "number" ||
        typeof edge.evidence.line_end !== "number"
      ) {
        return { ok: false, reason: "corrupt" };
      }
    }
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
