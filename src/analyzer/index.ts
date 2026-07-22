/**
 * RepoAtlas Analyzer Worker
 * Coordinates indexing, language packs, report assembly, and persistence.
 */

import { randomUUID } from "crypto";
import { ingestRepo } from "@/lib/ingest";
import { parseGithubRepoUrl } from "@/lib/github";
import { getCachedAnalysis, putCachedAnalysis } from "@/lib/analysisCache";
import { analyzeCommitInsights } from "./gitHistory";
import { discoverDocuments } from "./docs";
import { runIndexingPipeline } from "./pipeline";
import { computeDangerZones, computeStartHere } from "./scoring";
import { createDeadlineChecker } from "./analysisDeadline";
import {
  githubUrlOf,
  type AnalyzeInput,
  type AnalyzeOptions,
  type AnalyzeResult,
} from "./analysisTypes";
import {
  collectLanguageWarnings,
  combineArchitecture,
  runLanguagePacks,
} from "./languagePacks";
import { buildPartialReport, logPartialReport } from "./partialReport";
import { buildCompleteReport } from "./reportAssembly";
import { finishReport } from "./reportPersistence";

export type { AnalyzeInput, AnalyzeOptions, AnalyzeResult } from "./analysisTypes";

export async function analyzeRepository(
  input: AnalyzeInput,
  options: AnalyzeOptions = {}
): Promise<AnalyzeResult> {
  const reportId = randomUUID();
  const shouldPersist = options.persist !== false;
  const allowInlineFallback = options.allowInlineFallback === true;
  const deadline = createDeadlineChecker(options.deadlineMs, options.signal);
  const workspace = await ingestRepo(input, { signal: options.signal });

  const finish = (report: AnalyzeResult["report"]): Promise<AnalyzeResult> =>
    finishReport(
      reportId,
      report,
      shouldPersist,
      allowInlineFallback,
      options.requestId
    );

  const githubCoords =
    workspace.cloneHash && workspace.url
      ? parseGithubRepoUrl(workspace.url)
      : input.kind === "github"
        ? parseGithubRepoUrl(input.githubUrl)
        : null;

  try {
    deadline.throwIfAborted();

    if (githubCoords && workspace.cloneHash) {
      const cached = await getCachedAnalysis(
        githubCoords.owner,
        githubCoords.repo,
        workspace.cloneHash,
        options.analysisIntent
      );
      if (cached) {
        return finish({
          ...cached,
          analysis_intent: options.analysisIntent ?? cached.analysis_intent,
          repo_metadata: {
            ...cached.repo_metadata,
            analyzed_at: new Date().toISOString(),
            clone_hash: workspace.cloneHash,
            branch: workspace.branch ?? cached.repo_metadata.branch,
          },
        });
      }
    }

    const pipeline = await runIndexingPipeline(workspace.path);
    const documentInventory = discoverDocuments(
      workspace.path,
      Array.from(pipeline.file_metadata.keys())
    );
    const partialInput = {
      analyzeInput: input,
      workspacePath: workspace.path,
      workspaceName: workspace.name,
      workspaceUrl: workspace.url,
      workspaceBranch: workspace.branch,
      workspaceCloneHash: workspace.cloneHash,
      pipeline,
      documentInventory,
      analysisIntent: options.analysisIntent,
    };

    if (deadline.isExpired()) {
      logPartialReport(options.requestId);
      return finish(buildPartialReport(partialInput));
    }

    const filePaths = Array.from(pipeline.file_metadata.keys());
    const packs = runLanguagePacks(workspace.path, pipeline, filePaths);
    const architecture = combineArchitecture(packs);

    if (deadline.isExpired()) {
      logPartialReport(options.requestId);
      return finish(
        buildPartialReport({
          ...partialInput,
          architecture,
          extraWarnings: collectLanguageWarnings(packs),
        })
      );
    }

    const commitInsights = await analyzeCommitInsights(workspace.path, {
      githubUrl: githubUrlOf(input),
      sha: workspace.cloneHash,
      ref: workspace.branch ?? (input.kind === "github" ? input.ref : undefined),
    });
    const startHere = computeStartHere(pipeline, packs.tsjs, packs.python, packs.java);
    const dangerZones = computeDangerZones(
      pipeline,
      packs.tsjs,
      packs.python,
      packs.java,
      commitInsights
    );
    const reportWarnings = collectLanguageWarnings(packs);
    if (commitInsights.mode === "unavailable") {
      reportWarnings.push("Commit history unavailable for zip uploads without .git metadata.");
    }

    if (deadline.isExpired()) {
      logPartialReport(options.requestId);
      return finish(
        buildPartialReport({
          ...partialInput,
          architecture,
          startHere,
          dangerZones,
          extraWarnings: reportWarnings,
        })
      );
    }

    const result = await finish(
      buildCompleteReport({
        analyzeInput: input,
        analysisIntent: options.analysisIntent,
        workspace,
        pipeline,
        documentInventory,
        packs,
        architecture,
        commitInsights,
        startHere,
        dangerZones,
      })
    );

    if (githubCoords && workspace.cloneHash && !result.report.partial) {
      await putCachedAnalysis(
        githubCoords.owner,
        githubCoords.repo,
        workspace.cloneHash,
        result.report,
        options.analysisIntent
      ).catch(() => undefined);
    }

    return result;
  } finally {
    await workspace.cleanup?.();
  }
}
