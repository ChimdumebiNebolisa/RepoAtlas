/**
 * RepoAtlas Analyzer Worker
 * Runs common indexing + language packs; produces Report JSON.
 */

import path from "path";
import type { Report } from "@/types/report";
import { ingestRepo } from "@/lib/ingest";
import { runIndexingPipeline } from "./pipeline";
import { runTsJsPack } from "./packs/tsjs";
import { computeStartHere, computeDangerZones } from "./scoring";
import { saveReport } from "@/lib/storage";
import { randomUUID } from "crypto";

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
    const tsjsResult = runTsJsPack(workspace.path, pipeline);

    const architecture = tsjsResult?.architecture ?? {
      nodes: [],
      edges: [],
    };

    const startHere = computeStartHere(pipeline, tsjsResult);
    const dangerZones = computeDangerZones(pipeline, tsjsResult);

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
      warnings: pipeline.warnings,
    };

    await saveReport(reportId, report);
    return { reportId, report };
  } finally {
    await workspace.cleanup?.();
  }
}
