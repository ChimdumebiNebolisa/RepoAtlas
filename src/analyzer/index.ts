/**
 * RepoAtlas Analyzer Worker
 * Runs common indexing + language packs; produces Report JSON.
 */

import path from "path";
import type { Report } from "@/types/report";
import { ingestRepo } from "@/lib/ingest";
import { runIndexingPipeline } from "./pipeline";
import { runTsJsPack } from "./packs/tsjs";
import { runPythonPack } from "./packs/python";
import { runJavaPack } from "./packs/java";
import { computeStartHere, computeDangerZones } from "./scoring";
import { saveReport } from "@/lib/storage";
import { randomUUID } from "crypto";

const TSJS_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"]);
const PYTHON_EXTENSIONS = new Set([".py"]);
const JAVA_EXTENSIONS = new Set([".java"]);

export interface AnalyzeInput {
  githubUrl?: string;
  zipRef?: string;
}

export interface AnalyzeResult {
  reportId: string;
  report: Report;
}

export async function analyzeRepository(
  input: AnalyzeInput
): Promise<AnalyzeResult> {
  const reportId = randomUUID();
  const workspace = await ingestRepo(input);

  try {
    const pipeline = await runIndexingPipeline(workspace.path);
    const hasTsJsFiles = Array.from(pipeline.file_metadata.keys()).some((filePath) =>
      TSJS_EXTENSIONS.has(path.extname(filePath))
    );
    const hasPythonFiles = Array.from(pipeline.file_metadata.keys()).some((filePath) =>
      PYTHON_EXTENSIONS.has(path.extname(filePath))
    );
    const hasJavaFiles = Array.from(pipeline.file_metadata.keys()).some((filePath) =>
      JAVA_EXTENSIONS.has(path.extname(filePath))
    );
    const tsjsResult = hasTsJsFiles ? runTsJsPack(workspace.path, pipeline) : null;
    const pythonResult = hasPythonFiles ? runPythonPack(workspace.path, pipeline) : null;
    const javaResult = hasJavaFiles ? runJavaPack(workspace.path, pipeline) : null;

    const architecture =
      tsjsResult?.architecture ??
      pythonResult?.architecture ??
      javaResult?.architecture ??
      { nodes: [], edges: [] };

    const startHere = computeStartHere(pipeline, tsjsResult, pythonResult, javaResult);
    const dangerZones = computeDangerZones(pipeline, tsjsResult, pythonResult, javaResult);
    const warnings = [
      ...pipeline.warnings,
      ...(tsjsResult?.warnings ?? []),
      ...(pythonResult?.warnings ?? []),
      ...(javaResult?.warnings ?? []),
    ];
    if (!hasTsJsFiles && !hasPythonFiles && !hasJavaFiles) {
      warnings.push("Deep analysis unavailable: no supported source files detected.");
    } else {
      if (!hasTsJsFiles) {
        warnings.push(
          "Deep TS/JS analysis unavailable: no TypeScript or JavaScript source files detected."
        );
      }
      if (!hasPythonFiles) {
        warnings.push("Deep Python analysis unavailable: no Python source files detected.");
      }
      if (!hasJavaFiles) {
        warnings.push("Deep Java analysis unavailable: no Java source files detected.");
      }
    }

    const report: Report = {
      repo_metadata: {
        name: workspace.name,
        url: input.githubUrl ?? "zip",
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
      warnings,
    };

    await saveReport(reportId, report);
    return { reportId, report };
  } finally {
    await workspace.cleanup?.();
  }
}
