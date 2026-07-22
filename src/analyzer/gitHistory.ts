import fs from "fs";
import path from "path";
import { execSync } from "child_process";
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
    .sort((a, b) => b[1] - a[1])
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

function analyzeLocalGit(workspacePath: string): CommitInsights {
  const gitDir = path.join(workspacePath, ".git");
  if (!fs.existsSync(gitDir)) return UNAVAILABLE;

  try {
    execSync("git --version", { stdio: "ignore" });
    const names = execSync("git log --name-only --pretty=format: -n 20", {
      cwd: workspacePath,
      encoding: "utf-8",
      timeout: 10_000,
    });
    const fileCounts = new Map<string, number>();
    for (const line of names.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      fileCounts.set(trimmed, (fileCounts.get(trimmed) ?? 0) + 1);
    }
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

    const commits = (await res.json()) as Array<{ sha: string }>;
    const fileCounts = new Map<string, number>();

    for (const commit of commits.slice(0, 8)) {
      const detailRes = await fetch(
        `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/commits/${commit.sha}`,
        {
          headers: { ...GITHUB_JSON_HEADERS },
          signal: AbortSignal.timeout(10_000),
        }
      );
      if (!detailRes.ok) continue;
      const detail = (await detailRes.json()) as {
        files?: Array<{ filename: string }>;
      };
      for (const file of detail.files ?? []) {
        fileCounts.set(file.filename, (fileCounts.get(file.filename) ?? 0) + 1);
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
  const local = analyzeLocalGit(workspacePath);
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
  if (idx === -1) return 0;
  return Math.max(0, 100 - idx * 15);
}
