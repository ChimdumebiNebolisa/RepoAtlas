/**
 * Runtime validation for stored report JSON — versioned, deep shape checks.
 */

import type { Report } from "@/types/report";
import {
  hasValidArchitectureIntegrity,
  hasValidSemanticGraphIntegrity,
  isArchitectureEdge,
  isArchitectureNode,
  isSemanticGraph,
} from "./reportSchemaArchitecture";
import { reportCompatibilityFailure } from "./reportSchemaCompatibility";
import { hasValidCandidateBriefIntegrity } from "./reportSchemaEvidence";
import { isCandidateBrief } from "./reportSchemaFields";
import {
  isCommitInsights,
  isContributeSignals,
  isDangerZoneItem,
  isFolderMapNode,
  isObject,
  isRepoMetadata,
  isRunCommand,
  isStartHereItem,
  isStringArray,
} from "./reportSchemaPrimitives";

export type ReportLoadResult =
  | { ok: true; report: Report }
  | { ok: false; reason: "corrupt" | "incompatible" };

function hasValidReportIntegrity(report: Record<string, unknown>): boolean {
  if (
    !hasValidArchitectureIntegrity(
      report.architecture as Record<string, unknown>,
    ) ||
    !hasValidCandidateBriefIntegrity(report)
  ) {
    return false;
  }
  return (
    !isObject(report.semantic_graph) ||
    hasValidSemanticGraphIntegrity(report.semantic_graph)
  );
}

/** Validate parsed JSON as a supported Report. */
export function validateReport(data: unknown): ReportLoadResult {
  if (!isObject(data)) return { ok: false, reason: "corrupt" };

  const compatibilityFailure = reportCompatibilityFailure(data);
  if (compatibilityFailure) {
    return { ok: false, reason: compatibilityFailure };
  }

  if (!isRepoMetadata(data.repo_metadata))
    return { ok: false, reason: "corrupt" };
  if (!isFolderMapNode(data.folder_map))
    return { ok: false, reason: "corrupt" };

  if (
    !Array.isArray(data.start_here) ||
    !data.start_here.every(isStartHereItem)
  ) {
    return { ok: false, reason: "corrupt" };
  }
  if (
    !Array.isArray(data.danger_zones) ||
    !data.danger_zones.every(isDangerZoneItem)
  ) {
    return { ok: false, reason: "corrupt" };
  }
  if (
    !Array.isArray(data.run_commands) ||
    !data.run_commands.every(isRunCommand)
  ) {
    return { ok: false, reason: "corrupt" };
  }
  if (!isContributeSignals(data.contribute_signals))
    return { ok: false, reason: "corrupt" };
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
  if (!hasValidReportIntegrity(data)) {
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
