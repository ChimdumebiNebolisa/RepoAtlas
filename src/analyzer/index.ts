/**
 * RepoAtlas Analyzer Worker
 * Runs common indexing + language packs; produces Report JSON.
 */

import path from "path";
import fs from "fs";
import type { Report } from "@/types/report";
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
import { detectTechnicalDecisions } from "./decisions";
import { extractSymbols } from "./symbols";
import { buildTestInventory, detectTestFrameworks } from "./testInventory";
import { analyzeArchitectureBoundaries } from "./boundaries";
import { analyzeCommitInsights } from "./gitHistory";
import { saveReport } from "@/lib/storage";
import { randomUUID } from "crypto";

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
  /** Wall-clock budget for analysis. When exceeded after folder map, a partial report is saved. */
  deadlineMs?: number;
}

export interface AnalyzeResult {
  reportId: string;
  report: Report;
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

function createDeadlineChecker(deadlineMs?: number) {
  const start = Date.now();
  return {
    isExpired(): boolean {
      return deadlineMs != null && Date.now() - start >= deadlineMs;
    },
  };
}

function collectLanguageWarnings(packs: PackResults): string[] {
  const warnings: string[] = [
    ...(packs.tsjs?.warnings ?? []),
    ...(packs.python?.warnings ?? []),
    ...(packs.java?.warnings ?? []),
  ];
  if (!packs.hasTsJsFiles && !packs.hasPythonFiles && !packs.hasJavaFiles) {
    warnings.push("Deep analysis unavailable: no supported source files detected.");
  } else {
    if (!packs.hasTsJsFiles) {
      warnings.push(
        "Deep TS/JS analysis unavailable: no TypeScript or JavaScript source files detected."
      );
    }
    if (!packs.hasPythonFiles) {
      warnings.push("Deep Python analysis unavailable: no Python source files detected.");
    }
    if (!packs.hasJavaFiles) {
      warnings.push("Deep Java analysis unavailable: no Java source files detected.");
    }
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

function resolveArchitecture(packs: PackResults): Report["architecture"] {
  return (
    packs.tsjs?.architecture ??
    packs.python?.architecture ??
    packs.java?.architecture ??
    { nodes: [], edges: [] }
  );
}

function buildPartialReport(input: {
  analyzeInput: AnalyzeInput;
  workspacePath: string;
  workspaceName: string;
  workspaceUrl?: string | null;
  workspaceBranch?: string | null;
  workspaceCloneHash?: string | null;
  pipeline: IndexingPipelineResult;
  architecture?: Report["architecture"];
  startHere?: Report["start_here"];
  dangerZones?: Report["danger_zones"];
  extraWarnings?: string[];
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
    startHere,
    dangerZones,
    runCommands: input.pipeline.run_commands,
    contributeSignals: input.pipeline.contribute_signals,
    architecture,
    warnings,
    projectPurpose: extractProjectPurpose(input.workspacePath, input.pipeline.key_docs),
    workspacePath: input.workspacePath,
    keyDocs: input.pipeline.key_docs,
  });

  return {
    report_version: REPORT_VERSION,
    partial: true,
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
    warnings,
  };
}

async function persistReport(reportId: string, report: Report): Promise<AnalyzeResult> {
  await saveReport(reportId, report);
  return { reportId, report };
}

export async function analyzeRepository(
  input: AnalyzeInput,
  options: AnalyzeOptions = {}
): Promise<AnalyzeResult> {
  const reportId = randomUUID();
  const deadline = createDeadlineChecker(options.deadlineMs);
  const workspace = await ingestRepo(input);

  try {
    const pipeline = await runIndexingPipeline(workspace.path);

    if (deadline.isExpired()) {
      const report = buildPartialReport({
        analyzeInput: input,
        workspacePath: workspace.path,
        workspaceName: workspace.name,
        workspaceUrl: workspace.url,
        workspaceBranch: workspace.branch,
        workspaceCloneHash: workspace.cloneHash,
        pipeline,
      });
      return persistReport(reportId, report);
    }

    const filePaths = Array.from(pipeline.file_metadata.keys());
    const packs = runLanguagePacks(workspace.path, pipeline, filePaths);

    if (deadline.isExpired()) {
      const architecture = resolveArchitecture(packs);
      const report = buildPartialReport({
        analyzeInput: input,
        workspacePath: workspace.path,
        workspaceName: workspace.name,
        workspaceUrl: workspace.url,
        workspaceBranch: workspace.branch,
        workspaceCloneHash: workspace.cloneHash,
        pipeline,
        architecture,
        extraWarnings: collectLanguageWarnings(packs),
      });
      return persistReport(reportId, report);
    }

    const architecture = resolveArchitecture(packs);
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
      const report = buildPartialReport({
        analyzeInput: input,
        workspacePath: workspace.path,
        workspaceName: workspace.name,
        workspaceUrl: workspace.url,
        workspaceBranch: workspace.branch,
        workspaceCloneHash: workspace.cloneHash,
        pipeline,
        architecture,
        startHere,
        dangerZones,
        extraWarnings: warnings.filter((w) => !pipeline.warnings.includes(w)),
      });
      return persistReport(reportId, report);
    }

    const project_profile = detectProjectProfile(workspace.path, filePaths);
    const project_purpose = extractProjectPurpose(workspace.path, pipeline.key_docs);
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
      startHere,
      dangerZones,
      runCommands: pipeline.run_commands,
      contributeSignals: pipeline.contribute_signals,
      architecture,
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
    });

    const report: Report = {
      report_version: REPORT_VERSION,
      repo_metadata: {
        name: workspace.name,
        url: workspace.url ?? githubUrlOf(input) ?? "zip",
        branch: workspace.branch ?? "unknown",
        clone_hash: workspace.cloneHash ?? null,
        analyzed_at: new Date().toISOString(),
      },
      folder_map: pipeline.folder_map,
      architecture,
      start_here: startHere,
      danger_zones: dangerZones,
      run_commands: pipeline.run_commands,
      contribute_signals: pipeline.contribute_signals,
      candidate_brief,
      project_profile,
      project_purpose,
      technical_decisions,
      symbols,
      test_inventory,
      architecture_insights,
      commit_insights,
      warnings,
    };

    return persistReport(reportId, report);
  } finally {
    await workspace.cleanup?.();
  }
}
