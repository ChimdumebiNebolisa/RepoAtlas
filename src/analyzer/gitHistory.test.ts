import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import path from "path";
import fs from "fs";
import os from "os";
import type { CommitInsights } from "@/types/report";

const mocks = vi.hoisted(() => ({
  execFileSync: vi.fn(),
}));

vi.mock("child_process", async (importOriginal) => ({
  ...(await importOriginal<typeof import("child_process")>()),
  execFileSync: mocks.execFileSync,
}));

import { analyzeCommitInsights, churnScoreForFile } from "./gitHistory";

const githubUrl = "https://github.com/example/sample-repo";

function jsonResponse(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), { status });
}

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

  it("uses bounded local Git history and prefers the exact SHA", async () => {
    fs.mkdirSync(path.join(workspacePath, ".git"));
    mocks.execFileSync.mockReturnValueOnce(
      "src/index.ts\nsrc/index.ts\nsrc/utils.ts\n"
    );

    const insights = await analyzeCommitInsights(workspacePath, {
      githubUrl,
      sha: "deadbeefcafebabe",
      ref: "feature/experiment",
    });

    expect(insights).toMatchObject({
      mode: "local_git",
      high_churn_files: ["src/index.ts", "src/utils.ts"],
      recent_work_areas: ["src"],
    });
    expect(mocks.execFileSync).toHaveBeenCalledWith(
      "git",
      [
        "log",
        "--name-only",
        "--pretty=format:",
        "-n",
        "20",
        "--end-of-options",
        "deadbeefcafebabe",
        "--",
      ],
      expect.objectContaining({ cwd: workspacePath, timeout: 10_000 })
    );
    expect(fetch).not.toHaveBeenCalled();
  });

  it("uses the selected ref for local Git when the SHA is blank", async () => {
    fs.mkdirSync(path.join(workspacePath, ".git"));
    mocks.execFileSync.mockReturnValueOnce("README.md\n");

    await analyzeCommitInsights(workspacePath, { sha: " ", ref: "release/1.0" });

    expect(mocks.execFileSync).toHaveBeenCalledWith(
      "git",
      expect.arrayContaining(["release/1.0"]),
      expect.any(Object)
    );
  });

  it("returns unavailable without local Git or a GitHub source", async () => {
    const insights = await analyzeCommitInsights(workspacePath);

    expect(insights.mode).toBe("unavailable");
    expect(mocks.execFileSync).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
  });

  it.each([
    ["command failure", Object.assign(new Error("git failed"), { code: 128 })],
    ["timeout", Object.assign(new Error("timed out"), { code: "ETIMEDOUT" })],
  ])("falls back safely after a local Git %s", async (_label, error) => {
    fs.mkdirSync(path.join(workspacePath, ".git"));
    mocks.execFileSync.mockImplementationOnce(() => {
      throw error;
    });

    const insights = await analyzeCommitInsights(workspacePath);

    expect(insights.mode).toBe("unavailable");
  });

  it("returns unavailable when local Git has no valid file history", async () => {
    fs.mkdirSync(path.join(workspacePath, ".git"));
    mocks.execFileSync.mockReturnValueOnce(
      "# note\n../outside.ts\n/absolute.ts\nC:\\outside.ts\n\n"
    );

    const insights = await analyzeCommitInsights(workspacePath);

    expect(insights.mode).toBe("unavailable");
  });

  it("uses github_api when local Git is unavailable", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock
      .mockResolvedValueOnce(jsonResponse([{ sha: "abc123" }]))
      .mockResolvedValueOnce(
        jsonResponse({
          files: [{ filename: "src/index.ts" }, { filename: "src/utils.ts" }],
        })
      );

    const insights = await analyzeCommitInsights(workspacePath, { githubUrl });

    expect(insights.mode).toBe("github_api");
    expect(insights.high_churn_files).toEqual(["src/index.ts", "src/utils.ts"]);
    const firstUrl = String(fetchMock.mock.calls[0][0]);
    expect(firstUrl).toContain("api.github.com/repos/example/sample-repo/commits");
    expect(firstUrl).not.toContain("sha=");
  });

  it("scopes GitHub history to the ingested SHA instead of the ref", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock
      .mockResolvedValueOnce(jsonResponse([{ sha: "deadbeef" }]))
      .mockResolvedValueOnce(
        jsonResponse({ files: [{ filename: "feature/branch-only.ts" }] })
      );

    const insights = await analyzeCommitInsights(workspacePath, {
      githubUrl,
      sha: "deadbeefcafebabe",
      ref: "feature/experiment",
    });

    expect(insights.high_churn_files).toContain("feature/branch-only.ts");
    const firstUrl = String(fetchMock.mock.calls[0][0]);
    expect(firstUrl).toContain("sha=deadbeefcafebabe");
    expect(firstUrl).not.toContain("feature%2Fexperiment");
  });

  it("encodes the selected ref when SHA is unavailable", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock
      .mockResolvedValueOnce(jsonResponse([{ sha: "abc123" }]))
      .mockResolvedValueOnce(jsonResponse({ files: [{ filename: "src/a.ts" }] }));

    await analyzeCommitInsights(workspacePath, {
      githubUrl,
      ref: "release/1.0 + preview",
    });

    const firstUrl = String(fetchMock.mock.calls[0][0]);
    expect(firstUrl).toContain("sha=release%2F1.0%20%2B%20preview");
  });

  it("returns unavailable for invalid GitHub URLs and source sentinels", async () => {
    await expect(
      analyzeCommitInsights(workspacePath, {
        githubUrl: "https://gitlab.com/foo/bar",
      })
    ).resolves.toMatchObject({ mode: "unavailable" });
    await expect(
      analyzeCommitInsights(workspacePath, { githubUrl: "zip" })
    ).resolves.toMatchObject({ mode: "unavailable" });
    await expect(
      analyzeCommitInsights(workspacePath, { githubUrl: "   " })
    ).resolves.toMatchObject({ mode: "unavailable" });
    expect(fetch).not.toHaveBeenCalled();
  });

  it("returns unavailable when the GitHub commit list request fails", async () => {
    vi.mocked(fetch).mockResolvedValue(new Response("rate limited", { status: 403 }));

    const insights = await analyzeCommitInsights(workspacePath, { githubUrl });

    expect(insights.mode).toBe("unavailable");
  });

  it.each([
    ["an object", { sha: "abc123" }],
    ["null", null],
    ["an empty list", []],
    ["partial entries", [{}, null, { sha: 12 }, { sha: " " }]],
  ])("rejects a malformed GitHub commit list containing %s", async (_label, payload) => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(payload));

    const insights = await analyzeCommitInsights(workspacePath, { githubUrl });

    expect(insights.mode).toBe("unavailable");
    expect(fetch).toHaveBeenCalledOnce();
  });

  it("keeps valid commit-list entries and skips malformed detail payloads", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse([null, { sha: 7 }, { sha: "first" }, { sha: "second" }])
      )
      .mockResolvedValueOnce(jsonResponse({ files: "not-an-array" }))
      .mockResolvedValueOnce(
        jsonResponse({
          files: [
            null,
            {},
            { filename: 42 },
            { filename: "../outside.ts" },
            { filename: "src/valid.ts" },
            { filename: "src/valid.ts" },
          ],
        })
      );

    const insights = await analyzeCommitInsights(workspacePath, { githubUrl });

    expect(insights).toMatchObject({
      mode: "github_api",
      high_churn_files: ["src/valid.ts"],
    });
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("preserves valid history when one detail request fails or throws", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse([{ sha: "first" }, { sha: "second" }, { sha: "third" }])
      )
      .mockRejectedValueOnce(new Error("network failure"))
      .mockResolvedValueOnce(new Response("not found", { status: 404 }))
      .mockResolvedValueOnce(
        jsonResponse({ files: [{ filename: "src/survives.ts" }] })
      );

    const insights = await analyzeCommitInsights(workspacePath, { githubUrl });

    expect(insights).toMatchObject({
      mode: "github_api",
      high_churn_files: ["src/survives.ts"],
    });
  });

  it("returns unavailable when every detail result is empty", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock
      .mockResolvedValueOnce(jsonResponse([{ sha: "first" }, { sha: "second" }]))
      .mockResolvedValueOnce(jsonResponse({}))
      .mockResolvedValueOnce(jsonResponse({ files: [] }));

    const insights = await analyzeCommitInsights(workspacePath, { githubUrl });

    expect(insights.mode).toBe("unavailable");
  });

  it("returns unavailable when the commit list request throws", async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new Error("offline"));

    const insights = await analyzeCommitInsights(workspacePath, { githubUrl });

    expect(insights.mode).toBe("unavailable");
  });

  it("caps details at eight commits and ranks equal counts by stable path order", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(
      jsonResponse([
        ...Array.from({ length: 10 }, (_, index) => ({ sha: `sha-${index}` })),
        { sha: "sha-0" },
      ])
    );
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        files: [
          { filename: "z.ts" },
          { filename: "b.ts" },
          { filename: "e.ts" },
          { filename: "a.ts" },
          { filename: "f.ts" },
          { filename: "d.ts" },
          { filename: "c.ts" },
        ],
      })
    );
    for (let index = 1; index < 8; index += 1) {
      fetchMock.mockResolvedValueOnce(jsonResponse({ files: [] }));
    }

    const insights = await analyzeCommitInsights(workspacePath, { githubUrl });

    expect(insights.high_churn_files).toEqual(["a.ts", "b.ts", "c.ts", "d.ts", "e.ts"]);
    expect(insights.recent_work_areas).toEqual([]);
    expect(fetchMock).toHaveBeenCalledTimes(9);
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes("sha-8"))).toBe(
      false
    );
  });
});

describe("churnScoreForFile", () => {
  const insights: CommitInsights = {
    mode: "github_api",
    recent_work_areas: [],
    high_churn_files: ["a.ts", "b.ts", "c.ts", "d.ts", "e.ts", "outside-top-five.ts"],
    co_changed_pairs: [],
    evidence_refs: [],
  };

  it.each([
    ["a.ts", 100],
    ["b.ts", 85],
    ["c.ts", 70],
    ["d.ts", 55],
    ["e.ts", 40],
    ["outside-top-five.ts", 0],
    ["missing.ts", 0],
  ])("scores %s at the bounded rank value", (filePath, expected) => {
    expect(churnScoreForFile(filePath, insights)).toBe(expected);
  });

  it("returns zero when history is unavailable", () => {
    expect(
      churnScoreForFile("a.ts", {
        ...insights,
        mode: "unavailable",
      })
    ).toBe(0);
  });
});
