import fs from "fs";
import path from "path";
import type {
  AnalysisIntent,
  CommitInsights,
  DocumentInventory,
  Report,
} from "@/types/report";
import { REPORT_VERSION } from "@/types/report";
import type { IngestResult } from "@/lib/ingest";
import { analyzeArchitectureBoundaries } from "./boundaries";
import { detectTechnicalDecisions } from "./decisions";
import { buildCandidateBrief } from "./interview";
import type { PackResults } from "./languagePacks";
import { collectLanguageWarnings } from "./languagePacks";
import type { IndexingPipelineResult } from "./pipeline";
import { detectProjectProfile } from "./projectType";
import { extractProjectPurpose } from "./purpose";
import { extractSymbols } from "./symbols";
import { buildTestInventory, detectTestFrameworks } from "./testInventory";
import { githubUrlOf, type AnalyzeInput } from "./analysisTypes";

function readPackageDeps(workspacePath: string): Record<string, string> {
  const packagePath = path.join(workspacePath, "package.json");
  if (!fs.existsSync(packagePath)) return {};
  try {
    const pkg = JSON.parse(fs.readFileSync(packagePath, "utf-8"));
    return { ...pkg.dependencies, ...pkg.devDependencies };
  } catch {
    return {};
  }
}

export interface CompleteReportInput {
  analyzeInput: AnalyzeInput;
  analysisIntent?: AnalysisIntent;
  workspace: IngestResult;
  pipeline: IndexingPipelineResult;
  documentInventory: DocumentInventory;
  packs: PackResults;
  architecture: Report["architecture"];
  commitInsights: CommitInsights;
  startHere: Report["start_here"];
  dangerZones: Report["danger_zones"];
}

export function buildCompleteReport(input: CompleteReportInput): Report {
  const { workspace, pipeline, packs, architecture, commitInsights } = input;
  const filePaths = Array.from(pipeline.file_metadata.keys());
  const warnings = [...pipeline.warnings, ...collectLanguageWarnings(packs)];
  if (commitInsights.mode === "unavailable") {
    warnings.push("Commit history unavailable for zip uploads without .git metadata.");
  }

  const project_profile = detectProjectProfile(workspace.path, filePaths);
  const project_purpose = extractProjectPurpose(workspace.path, pipeline.key_docs, {
    canonicalReadme: input.documentInventory.canonical_readme,
    repoName: workspace.name,
  });
  const technicalDecisionDetection = detectTechnicalDecisions(workspace.path);
  const technical_decisions = technicalDecisionDetection.decisions;
  const symbols = extractSymbols(workspace.path, filePaths);
  const architecture_insights = analyzeArchitectureBoundaries(architecture);

  const allTestFiles = new Set<string>([
    ...(packs.tsjs?.testFiles ?? []),
    ...(packs.python?.testFiles ?? []),
    ...(packs.java?.testFiles ?? []),
  ]);
  const test_inventory = buildTestInventory({
    testFiles: allTestFiles,
    dangerZones: input.dangerZones,
    frameworks: detectTestFrameworks(workspace.path, readPackageDeps(workspace.path)),
  });

  const candidate_brief = buildCandidateBrief({
    repoName: workspace.name,
    analysisIntent: input.analysisIntent,
    startHere: input.startHere,
    dangerZones: input.dangerZones,
    runCommands: pipeline.run_commands,
    contributeSignals: pipeline.contribute_signals,
    architecture,
    semanticGraph: packs.tsjs?.semanticGraph,
    warnings,
    projectProfile: project_profile,
    projectPurpose: project_purpose,
    technicalDecisions: technical_decisions,
    technicalDecisionEvidence: technicalDecisionDetection.evidence,
    testInventory: test_inventory,
    commitInsights,
    architectureInsights: architecture_insights,
    symbols,
    workspacePath: workspace.path,
    keyDocs: pipeline.key_docs,
    documentInventory: input.documentInventory,
  });

  return {
    report_version: REPORT_VERSION,
    analysis_intent: input.analysisIntent ?? "interview",
    repo_metadata: {
      name: workspace.name,
      url: workspace.url ?? githubUrlOf(input.analyzeInput) ?? "zip",
      branch: workspace.branch ?? "unknown",
      clone_hash: workspace.cloneHash ?? null,
      analyzed_at: new Date().toISOString(),
    },
    folder_map: pipeline.folder_map,
    architecture,
    semantic_graph: packs.tsjs?.semanticGraph,
    start_here: input.startHere,
    danger_zones: input.dangerZones,
    run_commands: pipeline.run_commands,
    contribute_signals: pipeline.contribute_signals,
    candidate_brief,
    project_profile,
    project_purpose,
    document_inventory: input.documentInventory,
    technical_decisions,
    symbols,
    test_inventory,
    architecture_insights,
    commit_insights: commitInsights,
    warnings,
  };
}
