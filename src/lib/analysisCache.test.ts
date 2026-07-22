import { afterEach, describe, expect, it, vi } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import { analysisCacheKey, getCachedAnalysis, putCachedAnalysis } from "./analysisCache";
import { REPORT_VERSION, type Report } from "@/types/report";

describe("analysisCache", () => {
  let cacheDir: string;

  afterEach(() => {
    delete process.env.ANALYSIS_CACHE_DIR;
    if (cacheDir) fs.rmSync(cacheDir, { recursive: true, force: true });
    vi.unstubAllEnvs();
  });

  it("stores and retrieves same-SHA reports on the filesystem keyed by intent", async () => {
    cacheDir = fs.mkdtempSync(path.join(os.tmpdir(), "repoatlas-cache-"));
    process.env.ANALYSIS_CACHE_DIR = cacheDir;
    vi.stubEnv("VERCEL", "");

    const report = {
      report_version: REPORT_VERSION,
      analysis_intent: "interview" as const,
      repo_metadata: {
        name: "owner/repo",
        url: "https://github.com/owner/repo",
        branch: "main",
        clone_hash: "abc123",
        analyzed_at: new Date().toISOString(),
      },
      folder_map: { path: ".", type: "dir", children: [] },
      architecture: { nodes: [], edges: [] },
      start_here: [],
      danger_zones: [],
      run_commands: [],
      contribute_signals: { key_docs: [], ci_configs: [] },
      warnings: [],
    } satisfies Report;

    await putCachedAnalysis("owner", "repo", "abc123", report, "interview");
    const hit = await getCachedAnalysis("owner", "repo", "abc123", "interview");
    expect(hit?.repo_metadata.name).toBe("owner/repo");
    expect(await getCachedAnalysis("owner", "repo", "abc123", "bug")).toBeNull();
    expect(analysisCacheKey("Owner", "Repo", "ABC123", "interview")).toBe(
      analysisCacheKey("owner", "repo", "abc123", "interview")
    );
    expect(analysisCacheKey("owner", "repo", "abc123", "interview")).not.toBe(
      analysisCacheKey("owner", "repo", "abc123", "bug")
    );
  });

  it("rejects future cached_at timestamps", async () => {
    cacheDir = fs.mkdtempSync(path.join(os.tmpdir(), "repoatlas-cache-"));
    process.env.ANALYSIS_CACHE_DIR = cacheDir;
    const key = analysisCacheKey("owner", "repo", "abc123", "interview");
    const filePath = path.join(cacheDir, `${key}.json`);
    fs.mkdirSync(cacheDir, { recursive: true });
    fs.writeFileSync(
      filePath,
      JSON.stringify({
        cached_at: new Date(Date.now() + 86_400_000).toISOString(),
        owner: "owner",
        repo: "repo",
        sha: "abc123",
        intent: "interview",
        report: {
          report_version: REPORT_VERSION,
          repo_metadata: {
            name: "owner/repo",
            url: "https://github.com/owner/repo",
            branch: "main",
            clone_hash: "abc123",
            analyzed_at: new Date().toISOString(),
          },
          folder_map: { path: ".", type: "dir", children: [] },
          architecture: { nodes: [], edges: [] },
          start_here: [],
          danger_zones: [],
          run_commands: [],
          contribute_signals: { key_docs: [], ci_configs: [] },
          warnings: [],
        },
      })
    );
    expect(await getCachedAnalysis("owner", "repo", "abc123", "interview")).toBeNull();
  });
});
