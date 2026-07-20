/**
 * RepoAtlas Analyzer Worker
 * Runs common indexing + language packs; produces Report JSON.
 */

import path from "path";
import fs from "fs";
import type { AnalysisIntent, DocumentInventory, Report } from "@/types/report";
import { REPORT_VERSION } from "@/types/report";
import { ingestRepo } from "@/lib/ingest";
import { runIndexingPipeline, type IndexingPipelineResult } from "./pipeline";
import { runTsJsPack, type TsJsPackResult } from "./packs/tsjs";
import { runPythonPack, type PythonPackResult } from "./packs/python";
import { runJavaPack, type JavaPackResult } from "./packs/java";
import { computeStartHere, computeDangerZones } from "./scoring";
import { buildCandidateBrief } from "./interview";
import { detectProjectProfile } from "./projectType";
import { extractProjectPurpose } from "./purpose";
import { discoverDocuments } from "./docs";
import { detectTechnicalDecisions } from "./decisions";
import { extractSymbols } from "./symbols";
import { buildTestInventory, detectTestFrameworks } from "./testInventory";
import { analyzeArchitectureBoundaries } from "./boundaries";
import { analyzeCommitInsights } from "./gitHistory";
import { saveReport } from "@/lib/storage";
import { randomUUID } from "crypto";
import { AppError, ERROR_CODES } from "@/lib/errors";
import {
  partialAnalysisTimeoutLogPayload,
  reportPersistenceFailureLogPayload,
} from "@/lib/failureDiagnostics";

const TSJS_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"]);
const PYTHON_EXTENSIONS = new Set([".py"]);
const JAVA_EXTENSIONS = new Set([".java"]);

export type AnalyzeInput =
  | { kind?: "zip"; zipRef: string; zipName?: string; githubUrl?: undefined; ref?: undefined }
  | { kind: "github"; githubUrl: string; ref?: string; zipRef?: undefined; zipName?: undefined };

function githubUrlOf(input: AnalyzeInput): string | undefined {
  return input.githubUrl;
}

export interface AnalyzeOptions {
  /** Opaque request correlation identifier for privacy-safe diagnostics. */
  requestId?: string;
  /** Bounded job the generated Candidate Brief should be adapted for. */
  analysisIntent?: AnalysisIntent;
  /** Wall-clock budget for analysis. When exceeded after folder map, a partial report is saved. */
  deadlineMs?: number;
  /** Cooperative cancellation for the full request lifecycle. */
  signal?: AbortSignal;
  /** Persist the generated report for later retrieval and sharing. */
  persist?: boolean;
  /** Return the completed report inline when persistence fails. */
  allowInlineFallback?: boolean;
}

export interface AnalyzeResult {
  reportId: string;
  report: Report;
  persisted: boolean;
}

interface PackResults {
  tsjs: TsJsPackResult | null;
  python: PythonPackResult | null;
  java: JavaPackResult | null;
  hasTsJsFiles: boolean;
  hasPythonFiles: boolean;
  hasJavaFiles: boolean;
}

function readPackageDeps(workspacePath: string): Record<string, string> {
  const p = path.join(workspacePath, "package.json");
  if (!fs.existsSync(p)) return {};
  try {
    const pkg = JSON.parse(fs.readFileSync(p, "utf-8"));
    return { ...pkg.dependencies, ...pkg.devDependencies };
  } catch {
    return {};
  }
}

function createDeadlineChecker(deadlineMs?: number, signal?: AbortSignal) {
  const start = Date.now();
  return {
    isExpired(): boolean {
      if (signal?.aborted) return true;
      return deadlineMs != null && Date.now() - start >= deadlineMs;
    },
    throwIfAborted(): void {
      if (signal?.aborted) {
        throw new AppError({
          code: ERROR_CODES.TIMEOUT,
          status: 504,
          message: "Analysis timed out.",
        });
      }
    },
  };
}

function collectLanguageWarnings(packs: PackResults): string[] {
  const warnings: string[] = [
    ...(packs.tsjs?.warnings ?? []),
    ...(packs.python?.warnings ?? []),
    ...(packs.java?.warnings ?? []),
  ];
  // Only warn when no supported language is detected at all. A normal
  // single-language repository should not be told that the languages it simply
  // does not use are "unavailable" — that is noise, not a genuine gap.
  if (!packs.hasTsJsFiles && !packs.hasPythonFiles && !packs.hasJavaFiles) {
    warnings.push("Deep analysis unavailable: no supported source files detected.");
  }
  return warnings;
}

function runLanguagePacks(
  workspacePath: string,
  pipeline: IndexingPipelineResult,
  filePaths: string[]
): PackResults {
  const hasTsJsFiles = filePaths.some((filePath) =>
    TSJS_EXTENSIONS.has(path.extname(filePath))
  );
  const hasPythonFiles = filePaths.some((filePath) =>
    PYTHON_EXTENSIONS.has(path.extname(filePath))
  );
  const hasJavaFiles = filePaths.some((filePath) =>
    JAVA_EXTENSIONS.has(path.extname(filePath))
  );

  return {
    hasTsJsFiles,
    hasPythonFiles,
    hasJavaFiles,
    tsjs: hasTsJsFiles ? runTsJsPack(workspacePath, pipeline) : null,
    python: hasPythonFiles ? runPythonPack(workspacePath, pipeline) : null,
    java: hasJavaFiles ? runJavaPack(workspacePath, pipeline) : null,
  };
}

function combineArchitecture(packs: PackResults): Report["architecture"] {
  const nodes: Report["architecture"]["nodes"] = [];
  const edges: Report["architecture"]["edges"] = [];
  const seenNodeIds = new Set<string>();

  const addPack = (
    prefix: string,
    arch?: Report["architecture"] | null
  ): void => {
    if (!arch) return;
    for (const node of arch.nodes) {
      const id = `${prefix}:${node.id}`;
      if (seenNodeIds.has(id)) continue;
      seenNodeIds.add(id);
      nodes.push({ ...node, id });
    }
    for (const edge of arch.edges) {
      edges.push({
        ...edge,
        from: `${prefix}:${edge.from}`,
        to: `${prefix}:${edge.to}`,
      });
    }
  };

  addPack("tsjs", packs.tsjs?.architecture);
  addPack("python", packs.python?.architecture);
  addPack("java", packs.java?.architecture);

  return { nodes, edges };
}

function buildPartialReport(input: {
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
}): Report {
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

async function finishReport(
  reportId: string,
  report: Report,
  persist: boolean,
  allowInlineFallback: boolean,
  requestId?: string
): Promise<AnalyzeResult> {
  if (!persist) return { reportId, report, persisted: false };
  try {
    await saveReport(reportId, report);
    return { reportId, report, persisted: true };
  } catch (error) {
    if (!allowInlineFallback) throw error;
    console.warn(JSON.stringify(reportPersistenceFailureLogPayload(requestId)));
    return { reportId, report, persisted: false };
  }
}

export async function analyzeRepository(
  input: AnalyzeInput,
  options: AnalyzeOptions = {}
): Promise<AnalyzeResult> {
  const reportId = randomUUID();
  const shouldPersist = options.persist !== false;
  const allowInlineFallback = options.allowInlineFallback === true;
  const deadline = createDeadlineChecker(options.deadlineMs, options.signal);
  const workspace = await ingestRepo(input, { signal: options.signal });
  deadline.throwIfAborted();

  try {
    const pipeline = await runIndexingPipeline(workspace.path);
    const documentInventory = discoverDocuments(
      workspace.path,
      Array.from(pipeline.file_metadata.keys())
    );

    if (deadline.isExpired()) {
      console.warn(JSON.stringify(partialAnalysisTimeoutLogPayload(options.requestId)));
      const report = buildPartialReport({
        analyzeInput: input,
        workspacePath: workspace.path,
        workspaceName: workspace.name,
        workspaceUrl: workspace.url,
        workspaceBranch: workspace.branch,
        workspaceCloneHash: workspace.cloneHash,
        pipeline,
        documentInventory,
        analysisIntent: options.analysisIntent,
      });
      return finishReport(
        reportId,
        report,
        shouldPersist,
        allowInlineFallback,
        options.requestId
      );
    }

    const filePaths = Array.from(pipeline.file_metadata.keys());
    const packs = runLanguagePacks(workspace.path, pipeline, filePaths);

    if (deadline.isExpired()) {
      console.warn(JSON.stringify(partialAnalysisTimeoutLogPayload(options.requestId)));
      const architecture = combineArchitecture(packs);
      const report = buildPartialReport({
        analyzeInput: input,
        workspacePath: workspace.path,
        workspaceName: workspace.name,
        workspaceUrl: workspace.url,
        workspaceBranch: workspace.branch,
        workspaceCloneHash: workspace.cloneHash,
        pipeline,
        documentInventory,
        architecture,
        analysisIntent: options.analysisIntent,
        extraWarnings: collectLanguageWarnings(packs),
      });
      return finishReport(
        reportId,
        report,
        shouldPersist,
        allowInlineFallback,
        options.requestId
      );
    }

    const architecture = combineArchitecture(packs);
    const commit_insights = await analyzeCommitInsights(workspace.path, {
      githubUrl: githubUrlOf(input),
    });
    const startHere = computeStartHere(
      pipeline,
      packs.tsjs,
      packs.python,
      packs.java
    );
    const dangerZones = computeDangerZones(
      pipeline,
      packs.tsjs,
      packs.python,
      packs.java,
      commit_insights
    );

    const warnings = [
      ...pipeline.warnings,
      ...collectLanguageWarnings(packs),
    ];
    if (commit_insights.mode === "unavailable") {
      warnings.push("Commit history unavailable for zip uploads without .git metadata.");
    }

    if (deadline.isExpired()) {
      console.warn(JSON.stringify(partialAnalysisTimeoutLogPayload(options.requestId)));
      const report = buildPartialReport({
        analyzeInput: input,
        workspacePath: workspace.path,
        workspaceName: workspace.name,
        workspaceUrl: workspace.url,
        workspaceBranch: workspace.branch,
        workspaceCloneHash: workspace.cloneHash,
        pipeline,
        documentInventory,
        architecture,
        startHere,
        dangerZones,
        extraWarnings: warnings.filter((w) => !pipeline.warnings.includes(w)),
        analysisIntent: options.analysisIntent,
      });
      return finishReport(
        reportId,
        report,
        shouldPersist,
        allowInlineFallback,
        options.requestId
      );
    }

    const project_profile = detectProjectProfile(workspace.path, filePaths);
    const project_purpose = extractProjectPurpose(workspace.path, pipeline.key_docs, {
      canonicalReadme: documentInventory.canonical_readme,
      repoName: workspace.name,
    });
    const technical_decisions = detectTechnicalDecisions(workspace.path);
    const symbols = extractSymbols(workspace.path, filePaths);
    const architecture_insights = analyzeArchitectureBoundaries(architecture);

    const allTestFiles = new Set<string>([
      ...(packs.tsjs?.testFiles ?? []),
      ...(packs.python?.testFiles ?? []),
      ...(packs.java?.testFiles ?? []),
    ]);
    const deps = readPackageDeps(workspace.path);
    const test_inventory = buildTestInventory({
      testFiles: allTestFiles,
      dangerZones,
      frameworks: detectTestFrameworks(workspace.path, deps),
    });

    const candidate_brief = buildCandidateBrief({
      repoName: workspace.name,
      analysisIntent: options.analysisIntent,
      startHere,
      dangerZones,
      runCommands: pipeline.run_commands,
      contributeSignals: pipeline.contribute_signals,
      architecture,
      semanticGraph: packs.tsjs?.semanticGraph,
      warnings,
      projectProfile: project_profile,
      projectPurpose: project_purpose,
      technicalDecisions: technical_decisions,
      testInventory: test_inventory,
      commitInsights: commit_insights,
      architectureInsights: architecture_insights,
      symbols,
      workspacePath: workspace.path,
      keyDocs: pipeline.key_docs,
      documentInventory,
    });

    const report: Report = {
      report_version: REPORT_VERSION,
      analysis_intent: options.analysisIntent ?? "interview",
      repo_metadata: {
        name: workspace.name,
        url: workspace.url ?? githubUrlOf(input) ?? "zip",
        branch: workspace.branch ?? "unknown",
        clone_hash: workspace.cloneHash ?? null,
        analyzed_at: new Date().toISOString(),
      },
      folder_map: pipeline.folder_map,
      architecture,
      semantic_graph: packs.tsjs?.semanticGraph,
      start_here: startHere,
      danger_zones: dangerZones,
      run_commands: pipeline.run_commands,
      contribute_signals: pipeline.contribute_signals,
      candidate_brief,
      project_profile,
      project_purpose,
      document_inventory: documentInventory,
      technical_decisions,
      symbols,
      test_inventory,
      architecture_insights,
      commit_insights,
      warnings,
    };

    return finishReport(
      reportId,
      report,
      shouldPersist,
      allowInlineFallback,
      options.requestId
    );
  } finally {
    await workspace.cleanup?.();
  }
}
