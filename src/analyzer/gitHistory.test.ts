import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import path from "path";
import fs from "fs";
import os from "os";
import { analyzeCommitInsights } from "./gitHistory";

describe("analyzeCommitInsights", () => {
  let workspacePath: string;

  beforeEach(() => {
    workspacePath = fs.mkdtempSync(path.join(os.tmpdir(), "repoatlas-git-"));
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    fs.rmSync(workspacePath, { recursive: true, force: true });
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("uses github_api when local git is unavailable", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock
      .mockResolvedValueOnce(
        new Response(JSON.stringify([{ sha: "abc123" }]), { status: 200 })
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            files: [{ filename: "src/index.ts" }, { filename: "src/utils.ts" }],
          }),
          { status: 200 }
        )
      );

    const insights = await analyzeCommitInsights(workspacePath, {
      githubUrl: "https://github.com/example/sample-repo",
    });

    expect(insights.mode).toBe("github_api");
    expect(insights.high_churn_files).toContain("src/index.ts");
    expect(fetchMock).toHaveBeenCalled();
    const firstUrl = String(fetchMock.mock.calls[0][0]);
    expect(firstUrl).toContain("api.github.com/repos/example/sample-repo/commits");
    expect(firstUrl).not.toContain("sha=");
  });

  it("scopes github commit history to the ingested SHA tip", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock
      .mockResolvedValueOnce(
        new Response(JSON.stringify([{ sha: "deadbeef" }]), { status: 200 })
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            files: [{ filename: "feature/branch-only.ts" }],
          }),
          { status: 200 }
        )
      );

    const insights = await analyzeCommitInsights(workspacePath, {
      githubUrl: "https://github.com/example/sample-repo",
      sha: "deadbeefcafebabe",
      ref: "feature/experiment",
    });

    expect(insights.mode).toBe("github_api");
    expect(insights.high_churn_files).toContain("feature/branch-only.ts");
    const firstUrl = String(fetchMock.mock.calls[0][0]);
    expect(firstUrl).toContain("sha=deadbeefcafebabe");
    expect(firstUrl).not.toContain("feature%2Fexperiment");
  });

  it("falls back to the selected ref when SHA is unavailable", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock
      .mockResolvedValueOnce(
        new Response(JSON.stringify([{ sha: "abc123" }]), { status: 200 })
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ files: [{ filename: "src/a.ts" }] }), {
          status: 200,
        })
      );

    await analyzeCommitInsights(workspacePath, {
      githubUrl: "https://github.com/example/sample-repo",
      ref: "release/1.0",
    });

    const firstUrl = String(fetchMock.mock.calls[0][0]);
    expect(firstUrl).toContain("sha=release%2F1.0");
  });

  it("returns unavailable for invalid github urls", async () => {
    const insights = await analyzeCommitInsights(workspacePath, {
      githubUrl: "https://gitlab.com/foo/bar",
    });
    expect(insights.mode).toBe("unavailable");
    expect(fetch).not.toHaveBeenCalled();
  });

  it("returns unavailable when github api fails", async () => {
    vi.mocked(fetch).mockResolvedValue(new Response("rate limited", { status: 403 }));

    const insights = await analyzeCommitInsights(workspacePath, {
      githubUrl: "https://github.com/example/sample-repo",
    });

    expect(insights.mode).toBe("unavailable");
  });
});
