import fs from "fs";
import path from "path";
import * as childProcess from "child_process";
import type { CommitInsights } from "@/types/report";
import { validateGithubUrl } from "@/lib/ingest";

const UNAVAILABLE: CommitInsights = {
  mode: "unavailable",
  recent_work_areas: [],
  high_churn_files: [],
  co_changed_pairs: [],
  evidence_refs: [],
};

// GitHub commit history for user-supplied repositories is fetched WITHOUT any
// server credentials so a privileged server token can never expose private
// repository data to unauthenticated callers (Phase 1 finding B). Public
// repositories only.
const GITHUB_JSON_HEADERS = { Accept: "application/vnd.github+json" } as const;

export interface CommitInsightsOptions {
  githubUrl?: string;
  /** Exact commit SHA of the ingested archive tip (preferred history tip). */
  sha?: string | null;
  /** Branch or tag that was resolved for ingestion (fallback history tip). */
  ref?: string | null;
}

function buildInsightsFromFileCounts(
  fileCounts: Map<string, number>,
  mode: "local_git" | "github_api"
): CommitInsights {
  const high_churn_files = Array.from(fileCounts.entries())
    .sort(
      ([pathA, countA], [pathB, countB]) =>
        countB - countA || (pathA < pathB ? -1 : pathA > pathB ? 1 : 0)
    )
    .slice(0, 5)
    .map(([f]) => f);

  const dirs = new Set<string>();
  for (const f of high_churn_files) {
    const d = path.dirname(f);
    if (d && d !== ".") dirs.add(d.split("/")[0] ?? d);
  }

  return {
    mode,
    recent_work_areas: Array.from(dirs).slice(0, 5),
    high_churn_files,
    co_changed_pairs: [],
    evidence_refs: [],
  };
}

function analyzeLocalGit(
  workspacePath: string,
  opts?: Pick<CommitInsightsOptions, "sha" | "ref">
): CommitInsights {
  const gitDir = path.join(workspacePath, ".git");
  if (!fs.existsSync(gitDir)) return UNAVAILABLE;

  try {
    const tip = historyTip(opts);
    const revisionArgs = tip ? ["--end-of-options", tip, "--"] : [];
    const names = childProcess.execFileSync(
      "git",
      ["log", "--name-only", "--pretty=format:", "-n", "20", ...revisionArgs],
      {
        cwd: workspacePath,
        encoding: "utf-8",
        timeout: 10_000,
      }
    );
    const fileCounts = new Map<string, number>();
    for (const line of names.split("\n")) {
      const filePath = validHistoryFilePath(line);
      if (!filePath) continue;
      fileCounts.set(filePath, (fileCounts.get(filePath) ?? 0) + 1);
    }
    if (fileCounts.size === 0) return UNAVAILABLE;
    return buildInsightsFromFileCounts(fileCounts, "local_git");
  } catch {
    return UNAVAILABLE;
  }
}

function historyTip(opts?: Pick<CommitInsightsOptions, "sha" | "ref">): string | undefined {
  const sha = opts?.sha?.trim();
  if (sha) return sha;
  const ref = opts?.ref?.trim();
  return ref || undefined;
}

function validHistoryFilePath(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const filePath = value.trim();
  if (
    !filePath ||
    filePath.startsWith("#") ||
    path.posix.isAbsolute(filePath) ||
    path.win32.isAbsolute(filePath) ||
    filePath.split(/[\\/]/).includes("..")
  ) {
    return null;
  }
  return filePath;
}

function commitShas(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const uniqueShas = new Set<string>();
  for (const commit of value) {
    if (!commit || typeof commit !== "object" || !("sha" in commit)) continue;
    const sha = (commit as { sha?: unknown }).sha;
    if (typeof sha === "string" && sha.trim()) uniqueShas.add(sha.trim());
    if (uniqueShas.size === 8) break;
  }
  return Array.from(uniqueShas);
}

function detailFilePaths(value: unknown): string[] {
  if (!value || typeof value !== "object" || !("files" in value)) return [];
  const files = (value as { files?: unknown }).files;
  if (!Array.isArray(files)) return [];
  const uniquePaths = new Set<string>();
  for (const file of files) {
    if (!file || typeof file !== "object" || !("filename" in file)) continue;
    const filePath = validHistoryFilePath((file as { filename?: unknown }).filename);
    if (filePath) uniquePaths.add(filePath);
  }
  return Array.from(uniquePaths);
}

async function analyzeGithubApi(
  githubUrl: string,
  opts?: Pick<CommitInsightsOptions, "sha" | "ref">
): Promise<CommitInsights> {
  const parsed = validateGithubUrl(githubUrl);
  if (!parsed) return UNAVAILABLE;

  const { owner, repo } = parsed;
  const tip = historyTip(opts);
  // Scope history to the ingested tip so churn matches the analyzed tree
  // (selected branch/tag/SHA), not the repository default branch.
  const commitsUrl = tip
    ? `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/commits?sha=${encodeURIComponent(tip)}&per_page=15`
    : `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/commits?per_page=15`;

  try {
    const res = await fetch(commitsUrl, {
      headers: { ...GITHUB_JSON_HEADERS },
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) return UNAVAILABLE;

    const commits = commitShas(await res.json());
    if (commits.length === 0) return UNAVAILABLE;
    const fileCounts = new Map<string, number>();

    for (const commitSha of commits) {
      try {
        const detailRes = await fetch(
          `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/commits/${encodeURIComponent(commitSha)}`,
          {
            headers: { ...GITHUB_JSON_HEADERS },
            signal: AbortSignal.timeout(10_000),
          }
        );
        if (!detailRes.ok) continue;
        for (const filePath of detailFilePaths(await detailRes.json())) {
          fileCounts.set(filePath, (fileCounts.get(filePath) ?? 0) + 1);
        }
      } catch {
        continue;
      }
    }

    if (fileCounts.size === 0) return UNAVAILABLE;
    return buildInsightsFromFileCounts(fileCounts, "github_api");
  } catch {
    return UNAVAILABLE;
  }
}

export async function analyzeCommitInsights(
  workspacePath: string,
  opts?: CommitInsightsOptions
): Promise<CommitInsights> {
  const local = analyzeLocalGit(workspacePath, { sha: opts?.sha, ref: opts?.ref });
  if (local.mode !== "unavailable") return local;

  const githubUrl = opts?.githubUrl?.trim();
  if (githubUrl && githubUrl !== "zip" && githubUrl.includes("github.com")) {
    return analyzeGithubApi(githubUrl, { sha: opts?.sha, ref: opts?.ref });
  }

  return UNAVAILABLE;
}

export function churnScoreForFile(filePath: string, insights: CommitInsights): number {
  if (insights.mode === "unavailable") return 0;
  const idx = insights.high_churn_files.indexOf(filePath);
  if (idx < 0 || idx >= 5) return 0;
  return 100 - idx * 15;
}
