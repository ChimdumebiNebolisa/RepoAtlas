import fs from "fs";
import path from "path";
import { execSync } from "child_process";
import type { CommitInsights } from "@/types/report";

export function analyzeCommitInsights(workspacePath: string): CommitInsights {
  const gitDir = path.join(workspacePath, ".git");
  if (!fs.existsSync(gitDir)) {
    return {
      mode: "unavailable",
      recent_work_areas: [],
      high_churn_files: [],
      co_changed_pairs: [],
      evidence_refs: [],
    };
  }

  try {
    execSync("git --version", { stdio: "ignore" });
    const log = execSync("git log --oneline -n 20", {
      cwd: workspacePath,
      encoding: "utf-8",
      timeout: 10_000,
    });
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
      mode: "local_git",
      recent_work_areas: Array.from(dirs).slice(0, 5),
      high_churn_files,
      co_changed_pairs: [],
      evidence_refs: [],
    };
  } catch {
    return {
      mode: "unavailable",
      recent_work_areas: [],
      high_churn_files: [],
      co_changed_pairs: [],
      evidence_refs: [],
    };
  }
}

export function churnScoreForFile(filePath: string, insights: CommitInsights): number {
  if (insights.mode === "unavailable") return 0;
  const idx = insights.high_churn_files.indexOf(filePath);
  if (idx === -1) return 0;
  return Math.max(0, 100 - idx * 15);
}
