/**
 * Runtime validation for stored report JSON — versioned, deep shape checks.
 */

import type { Report } from "@/types/report";
import { ANALYSIS_INTENTS, REPORT_VERSION } from "@/types/report";

export type ReportLoadResult =
  | { ok: true; report: Report }
  | { ok: false; reason: "corrupt" | "incompatible" };

function isObject(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === "object" && !Array.isArray(value);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function isConfidence(value: unknown): boolean {
  return value === "high" || value === "medium" || value === "low";
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
  if (value.truncated != null && typeof value.truncated !== "boolean") return false;
  if (value.children != null) {
    if (!Array.isArray(value.children)) return false;
    if (!value.children.every(isFolderMapNode)) return false;
  }
  return true;
}

function isStartHereItem(value: unknown): boolean {
  if (!isObject(value)) return false;
  return (
    typeof value.path === "string" &&
    typeof value.score === "number" &&
    Number.isFinite(value.score) &&
    typeof value.explanation === "string"
  );
}

function isDangerZoneItem(value: unknown): boolean {
  if (!isObject(value)) return false;
  if (
    typeof value.path !== "string" ||
    typeof value.score !== "number" ||
    !Number.isFinite(value.score) ||
    typeof value.breakdown !== "string" ||
    !isObject(value.metrics)
  ) {
    return false;
  }
  for (const key of ["size", "fan_in", "fan_out", "complexity", "test_proximity", "churn"] as const) {
    if (value.metrics[key] != null && typeof value.metrics[key] !== "number") return false;
  }
  return true;
}

function isRunCommand(value: unknown): boolean {
  if (!isObject(value)) return false;
  return (
    typeof value.source === "string" &&
    typeof value.command === "string" &&
    (value.description == null || typeof value.description === "string")
  );
}

function isContributeSignals(value: unknown): boolean {
  if (!isObject(value)) return false;
  return isStringArray(value.key_docs) && isStringArray(value.ci_configs);
}

function isArchitectureNode(value: unknown): boolean {
  if (!isObject(value)) return false;
  if (typeof value.id !== "string" || typeof value.label !== "string") return false;
  if (
    value.type != null &&
    value.type !== "file" &&
    value.type !== "module" &&
    value.type !== "folder"
  ) {
    return false;
  }
  return true;
}

function isArchitectureEdge(value: unknown): boolean {
  if (!isObject(value)) return false;
  if (typeof value.from !== "string" || typeof value.to !== "string") return false;
  if (value.type != null && value.type !== "import" && value.type !== "dependency") return false;
  return true;
}

function isEvidenceRef(value: unknown): boolean {
  if (!isObject(value)) return false;
  if (typeof value.id !== "string" || typeof value.kind !== "string" || typeof value.label !== "string") {
    return false;
  }
  for (const key of ["path", "command", "detail", "snippet"] as const) {
    if (value[key] != null && typeof value[key] !== "string") return false;
  }
  for (const key of ["line_start", "line_end"] as const) {
    if (value[key] != null && typeof value[key] !== "number") return false;
  }
  return true;
}

function isCandidateBrief(value: unknown): boolean {
  if (!isObject(value)) return false;
  if (!isObject(value.repo_summary)) return false;
  if (
    typeof value.repo_summary.headline !== "string" ||
    !isConfidence(value.repo_summary.confidence)
  ) {
    return false;
  }
  if (!Array.isArray(value.reading_path)) return false;
  for (const item of value.reading_path) {
    if (!isObject(item)) return false;
    if (
      typeof item.order !== "number" ||
      typeof item.title !== "string" ||
      typeof item.path !== "string"
    ) {
      return false;
    }
  }
  if (!Array.isArray(value.first_pr_plan)) return false;
  for (const item of value.first_pr_plan) {
    if (!isObject(item)) return false;
    if (typeof item.title !== "string" || typeof item.rationale !== "string") return false;
  }
  if (value.evidence_refs != null) {
    if (!Array.isArray(value.evidence_refs) || !value.evidence_refs.every(isEvidenceRef)) {
      return false;
    }
  }
  return true;
}

function isCommitInsights(value: unknown): boolean {
  if (!isObject(value)) return false;
  if (
    value.mode !== "local_git" &&
    value.mode !== "github_api" &&
    value.mode !== "unavailable"
  ) {
    return false;
  }
  return (
    isStringArray(value.recent_work_areas) &&
    isStringArray(value.high_churn_files) &&
    Array.isArray(value.co_changed_pairs) &&
    Array.isArray(value.evidence_refs)
  );
}

function isSemanticGraph(value: unknown): boolean {
  if (!isObject(value)) return false;
  if (typeof value.version !== "number") return false;
  if (typeof value.language !== "string" || typeof value.adapter !== "string") return false;
  if (!Array.isArray(value.nodes) || !Array.isArray(value.edges)) return false;
  if (!isObject(value.stats) || !Array.isArray(value.warnings)) return false;
  for (const key of [
    "node_count",
    "edge_count",
    "resolved_internal",
    "resolved_external",
    "unresolved",
    "ignored",
    "entrypoint_count",
  ] as const) {
    if (typeof value.stats[key] !== "number") return false;
  }
  for (const edge of value.edges) {
    if (!isObject(edge)) return false;
    if (typeof edge.from !== "string" || typeof edge.specifier !== "string") return false;
    if (typeof edge.kind !== "string" || typeof edge.resolution !== "string") return false;
    if (!isObject(edge.evidence)) return false;
    if (
      typeof edge.evidence.path !== "string" ||
      typeof edge.evidence.line_start !== "number" ||
      typeof edge.evidence.line_end !== "number"
    ) {
      return false;
    }
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
  if (version != null && typeof version !== "number") {
    return { ok: false, reason: "corrupt" };
  }
  if (
    data.analysis_intent != null &&
    !ANALYSIS_INTENTS.some((intent) => intent === data.analysis_intent)
  ) {
    return { ok: false, reason: "corrupt" };
  }

  if (!isRepoMetadata(data.repo_metadata)) return { ok: false, reason: "corrupt" };
  if (!isFolderMapNode(data.folder_map)) return { ok: false, reason: "corrupt" };

  if (!Array.isArray(data.start_here) || !data.start_here.every(isStartHereItem)) {
    return { ok: false, reason: "corrupt" };
  }
  if (!Array.isArray(data.danger_zones) || !data.danger_zones.every(isDangerZoneItem)) {
    return { ok: false, reason: "corrupt" };
  }
  if (!Array.isArray(data.run_commands) || !data.run_commands.every(isRunCommand)) {
    return { ok: false, reason: "corrupt" };
  }
  if (!isContributeSignals(data.contribute_signals)) return { ok: false, reason: "corrupt" };
  if (!isStringArray(data.warnings)) return { ok: false, reason: "corrupt" };

  if (!isObject(data.architecture)) return { ok: false, reason: "corrupt" };
  if (
    !Array.isArray(data.architecture.nodes) ||
    !data.architecture.nodes.every(isArchitectureNode) ||
    !Array.isArray(data.architecture.edges) ||
    !data.architecture.edges.every(isArchitectureEdge)
  ) {
    return { ok: false, reason: "corrupt" };
  }

  if (data.candidate_brief != null && !isCandidateBrief(data.candidate_brief)) {
    return { ok: false, reason: "corrupt" };
  }
  if (data.commit_insights != null && !isCommitInsights(data.commit_insights)) {
    return { ok: false, reason: "corrupt" };
  }
  if (data.semantic_graph != null && !isSemanticGraph(data.semantic_graph)) {
    return { ok: false, reason: "corrupt" };
  }
  if (data.partial != null && typeof data.partial !== "boolean") {
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
