import type { AnalysisIntent, DocumentInventory, Report } from "@/types/report";
import { REPORT_VERSION } from "@/types/report";
import { partialAnalysisTimeoutLogPayload } from "@/lib/failureDiagnostics";
import { buildCandidateBrief } from "./interview";
import { extractProjectPurpose } from "./purpose";
import type { IndexingPipelineResult } from "./pipeline";
import { githubUrlOf, type AnalyzeInput } from "./analysisTypes";

export interface PartialReportInput {
  analyzeInput: AnalyzeInput;
  workspacePath: string;
  workspaceName: string;
  workspaceUrl?: string | null;
  workspaceBranch?: string | null;
  workspaceCloneHash?: string | null;
  pipeline: IndexingPipelineResult;
  documentInventory: DocumentInventory;
  architecture?: Report["architecture"];
  startHere?: Report["start_here"];
  dangerZones?: Report["danger_zones"];
  extraWarnings?: string[];
  analysisIntent?: AnalysisIntent;
}

export function logPartialReport(requestId?: string): void {
  console.warn(JSON.stringify(partialAnalysisTimeoutLogPayload(requestId)));
}

export function buildPartialReport(input: PartialReportInput): Report {
  const architecture = input.architecture ?? { nodes: [], edges: [] };
  const startHere = input.startHere ?? [];
  const dangerZones = input.dangerZones ?? [];
  const warnings = [
    ...input.pipeline.warnings,
    ...(input.extraWarnings ?? []),
    "Analysis timed out before completing. This is a partial report.",
  ];

  const candidate_brief = buildCandidateBrief({
    repoName: input.workspaceName,
    analysisIntent: input.analysisIntent,
    startHere,
    dangerZones,
    runCommands: input.pipeline.run_commands,
    contributeSignals: input.pipeline.contribute_signals,
    architecture,
    warnings,
    projectPurpose: extractProjectPurpose(input.workspacePath, input.pipeline.key_docs, {
      canonicalReadme: input.documentInventory.canonical_readme,
      repoName: input.workspaceName,
    }),
    workspacePath: input.workspacePath,
    keyDocs: input.pipeline.key_docs,
    documentInventory: input.documentInventory,
  });

  return {
    report_version: REPORT_VERSION,
    partial: true,
    analysis_intent: input.analysisIntent ?? "interview",
    repo_metadata: {
      name: input.workspaceName,
      url: input.workspaceUrl ?? githubUrlOf(input.analyzeInput) ?? "zip",
      branch: input.workspaceBranch ?? "unknown",
      clone_hash: input.workspaceCloneHash ?? null,
      analyzed_at: new Date().toISOString(),
    },
    folder_map: input.pipeline.folder_map,
    architecture,
    start_here: startHere,
    danger_zones: dangerZones,
    run_commands: input.pipeline.run_commands,
    contribute_signals: input.pipeline.contribute_signals,
    candidate_brief,
    document_inventory: input.documentInventory,
    warnings,
  };
}
