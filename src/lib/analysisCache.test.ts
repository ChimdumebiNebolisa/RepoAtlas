import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import type { AnalysisIntent, Report } from "@/types/report";
import { REPORT_VERSION } from "@/types/report";

const blobMocks = vi.hoisted(() => ({
  get: vi.fn(),
  put: vi.fn(),
  del: vi.fn(),
}));

vi.mock("@vercel/blob", () => ({
  ...blobMocks,
}));

import {
  analysisCacheKey,
  getCachedAnalysis,
  putCachedAnalysis,
} from "./analysisCache";

const OWNER = "owner";
const REPO = "repo";
const SHA = "abc123";

function report(intent: AnalysisIntent = "interview"): Report {
  return {
    report_version: REPORT_VERSION,
    analysis_intent: intent,
    repo_metadata: {
      name: `${OWNER}/${REPO}`,
      url: `https://github.com/${OWNER}/${REPO}`,
      branch: "main",
      clone_hash: SHA,
      analyzed_at: "2026-07-23T00:00:00.000Z",
    },
    folder_map: { path: ".", type: "dir", children: [] },
    architecture: { nodes: [], edges: [] },
    start_here: [],
    danger_zones: [],
    run_commands: [],
    contribute_signals: { key_docs: [], ci_configs: [] },
    warnings: [],
  };
}

function envelope(
  overrides: Partial<{
    cached_at: unknown;
    owner: unknown;
    repo: unknown;
    sha: unknown;
    intent: unknown;
    report: unknown;
  }> = {}
) {
  return {
    cached_at: "2026-07-23T00:00:00.000Z",
    owner: OWNER,
    repo: REPO,
    sha: SHA,
    intent: "interview",
    report: report(),
    ...overrides,
  };
}

describe("analysisCache", () => {
  let cacheDir: string | undefined;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-23T00:00:00.000Z"));
    blobMocks.get.mockReset();
    blobMocks.put.mockReset();
    blobMocks.del.mockReset();
    delete process.env.ANALYSIS_CACHE_DIR;
    delete process.env.BLOB_READ_WRITE_TOKEN;
    delete process.env.BLOB_STORE_ID;
    delete process.env.VERCEL_OIDC_TOKEN;
    delete process.env.REPORT_TTL_DAYS;
    process.env.VERCEL = "";
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    delete process.env.ANALYSIS_CACHE_DIR;
    delete process.env.BLOB_READ_WRITE_TOKEN;
    delete process.env.BLOB_STORE_ID;
    delete process.env.VERCEL_OIDC_TOKEN;
    delete process.env.REPORT_TTL_DAYS;
    delete process.env.VERCEL;
    if (cacheDir) fs.rmSync(cacheDir, { recursive: true, force: true });
    cacheDir = undefined;
  });

  function useFilesystem() {
    cacheDir = fs.mkdtempSync(path.join(os.tmpdir(), "repoatlas-cache-"));
    process.env.ANALYSIS_CACHE_DIR = cacheDir;
  }

  function cachePath(intent: AnalysisIntent = "interview") {
    if (!cacheDir) throw new Error("filesystem cache is not configured");
    return path.join(
      cacheDir,
      `${analysisCacheKey(OWNER, REPO, SHA, intent)}.json`
    );
  }

  function writeEnvelope(
    value: unknown,
    intent: AnalysisIntent = "interview"
  ) {
    fs.mkdirSync(cacheDir!, { recursive: true });
    fs.writeFileSync(
      cachePath(intent),
      typeof value === "string" ? value : JSON.stringify(value)
    );
  }

  it("stores and retrieves same-commit reports on the filesystem", async () => {
    useFilesystem();

    await putCachedAnalysis(OWNER, REPO, SHA, report(), "interview");

    await expect(
      getCachedAnalysis(OWNER, REPO, SHA, "interview")
    ).resolves.toEqual(report());
    const [storedFile] = fs.readdirSync(cacheDir!);
    expect(storedFile).toMatch(/^[a-f0-9]{40}\.json$/);
    expect(fs.statSync(cachePath()).mode & 0o777).toBe(0o600);
    expect(fs.readdirSync(cacheDir!).some((file) => file.endsWith(".tmp"))).toBe(
      false
    );
  });

  it("keeps cache identity case-insensitive, intent-specific, and versioned", () => {
    expect(analysisCacheKey("Owner", "Repo", "ABC123")).toBe(
      analysisCacheKey(OWNER, REPO, SHA, "interview")
    );
    expect(analysisCacheKey(OWNER, REPO, SHA, "interview")).not.toBe(
      analysisCacheKey(OWNER, REPO, SHA, "bug")
    );
    expect(analysisCacheKey(OWNER, REPO, SHA, undefined)).toBe(
      analysisCacheKey(OWNER, REPO, SHA, "interview")
    );
  });

  it("treats absent filesystem entries as cache misses", async () => {
    useFilesystem();

    await expect(
      getCachedAnalysis(OWNER, REPO, SHA, "interview")
    ).resolves.toBeNull();
  });

  it.each([
    ["invalid JSON", "not-json"],
    ["a primitive", JSON.stringify(7)],
    ["a missing timestamp", envelope({ cached_at: undefined })],
    ["a non-string timestamp", envelope({ cached_at: 7 })],
    ["a missing owner", envelope({ owner: undefined })],
    ["a missing repository", envelope({ repo: undefined })],
    ["a missing commit", envelope({ sha: undefined })],
    ["a missing intent", envelope({ intent: undefined })],
    ["an invalid report", envelope({ report: { private: "do not return" } })],
  ])("rejects and removes %s filesystem envelopes", async (_label, value) => {
    useFilesystem();
    writeEnvelope(value);

    await expect(
      getCachedAnalysis(OWNER, REPO, SHA, "interview")
    ).resolves.toBeNull();
    expect(fs.existsSync(cachePath())).toBe(false);
  });

  it.each([
    ["owner", { owner: "another-owner" }],
    ["repository", { repo: "another-repo" }],
    ["commit", { sha: "def456" }],
    ["intent", { intent: "bug" }],
  ])("rejects and removes %s mismatches", async (_label, overrides) => {
    useFilesystem();
    writeEnvelope(envelope(overrides));

    await expect(
      getCachedAnalysis(OWNER, REPO, SHA, "interview")
    ).resolves.toBeNull();
    expect(fs.existsSync(cachePath())).toBe(false);
  });

  it("accepts identity fields case-insensitively", async () => {
    useFilesystem();
    writeEnvelope(
      envelope({ owner: "OWNER", repo: "REPO", sha: "ABC123" })
    );

    await expect(
      getCachedAnalysis(OWNER, REPO, SHA, "interview")
    ).resolves.toEqual(report());
  });

  it.each([
    ["an invalid timestamp", "not-a-date"],
    ["an expired timestamp", "2026-07-21T23:59:59.999Z"],
    ["a timestamp beyond future skew", "2026-07-23T00:01:00.001Z"],
  ])("rejects and removes %s", async (_label, cachedAt) => {
    useFilesystem();
    process.env.REPORT_TTL_DAYS = "1";
    writeEnvelope(envelope({ cached_at: cachedAt }));

    await expect(
      getCachedAnalysis(OWNER, REPO, SHA, "interview")
    ).resolves.toBeNull();
    expect(fs.existsSync(cachePath())).toBe(false);
  });

  it("accepts exact expiry and future-skew boundaries", async () => {
    useFilesystem();
    process.env.REPORT_TTL_DAYS = "1";
    writeEnvelope(envelope({ cached_at: "2026-07-22T00:00:00.000Z" }));
    await expect(
      getCachedAnalysis(OWNER, REPO, SHA, "interview")
    ).resolves.toEqual(report());

    writeEnvelope(envelope({ cached_at: "2026-07-23T00:01:00.000Z" }));
    await expect(
      getCachedAnalysis(OWNER, REPO, SHA, "interview")
    ).resolves.toEqual(report());
  });

  it("treats filesystem read failures as cache misses", async () => {
    useFilesystem();
    writeEnvelope(envelope());
    vi.spyOn(fs.promises, "readFile").mockRejectedValueOnce(
      new Error("read unavailable")
    );

    await expect(
      getCachedAnalysis(OWNER, REPO, SHA, "interview")
    ).resolves.toBeNull();
  });

  it("ignores failed filesystem cleanup", async () => {
    useFilesystem();
    writeEnvelope("not-json");
    vi.spyOn(fs.promises, "unlink").mockRejectedValueOnce(
      new Error("cleanup unavailable")
    );

    await expect(
      getCachedAnalysis(OWNER, REPO, SHA, "interview")
    ).resolves.toBeNull();
  });

  it("does not read or write ephemeral Vercel storage without Blob credentials", async () => {
    useFilesystem();
    process.env.VERCEL = "1";

    await putCachedAnalysis(OWNER, REPO, SHA, report(), "interview");

    expect(fs.readdirSync(cacheDir!)).toEqual([]);
    await expect(
      getCachedAnalysis(OWNER, REPO, SHA, "interview")
    ).resolves.toBeNull();
  });

  it("reads private Blob streams with a static token", async () => {
    process.env.BLOB_READ_WRITE_TOKEN = "test-token";
    const body = JSON.stringify(envelope());
    blobMocks.get.mockResolvedValue({
      statusCode: 200,
      stream: new Response(body).body,
    });

    await expect(
      getCachedAnalysis(OWNER, REPO, SHA, "interview")
    ).resolves.toEqual(report());
    expect(blobMocks.get).toHaveBeenCalledWith(
      `analysis-cache/${analysisCacheKey(OWNER, REPO, SHA)}.json`,
      { access: "private", token: "test-token" }
    );
    expect(blobMocks.del).not.toHaveBeenCalled();
  });

  it("uses connected-store OIDC without passing a static Blob token", async () => {
    process.env.VERCEL = "1";
    process.env.BLOB_STORE_ID = "store_test";
    blobMocks.get.mockResolvedValue({
      statusCode: 200,
      stream: new Response(JSON.stringify(envelope())).body,
    });

    await expect(
      getCachedAnalysis(OWNER, REPO, SHA, "interview")
    ).resolves.toEqual(report());
    expect(blobMocks.get).toHaveBeenCalledWith(expect.any(String), {
      access: "private",
    });
  });

  it.each([
    ["a missing result", null],
    ["a missing object", undefined],
    ["a non-success status", { statusCode: 404, stream: null }],
    ["a missing stream", { statusCode: 200, stream: null }],
  ])("treats %s as a Blob cache miss", async (_label, result) => {
    process.env.BLOB_READ_WRITE_TOKEN = "test-token";
    blobMocks.get.mockResolvedValue(result);

    await expect(
      getCachedAnalysis(OWNER, REPO, SHA, "interview")
    ).resolves.toBeNull();
    expect(blobMocks.del).not.toHaveBeenCalled();
  });

  it("removes invalid and mismatched Blob entries", async () => {
    process.env.BLOB_READ_WRITE_TOKEN = "test-token";
    blobMocks.get
      .mockResolvedValueOnce({
        statusCode: 200,
        stream: new Response("not-json").body,
      })
      .mockResolvedValueOnce({
        statusCode: 200,
        stream: new Response(
          JSON.stringify(envelope({ owner: "another-owner" }))
        ).body,
      });
    blobMocks.del.mockResolvedValue(undefined);

    await expect(
      getCachedAnalysis(OWNER, REPO, SHA, "interview")
    ).resolves.toBeNull();
    await expect(
      getCachedAnalysis(OWNER, REPO, SHA, "interview")
    ).resolves.toBeNull();
    expect(blobMocks.del).toHaveBeenCalledTimes(2);
  });

  it("ignores failed Blob cleanup", async () => {
    process.env.BLOB_READ_WRITE_TOKEN = "test-token";
    blobMocks.get.mockResolvedValue({
      statusCode: 200,
      stream: new Response(JSON.stringify(envelope({ sha: "stale" }))).body,
    });
    blobMocks.del.mockRejectedValue(new Error("cleanup unavailable"));

    await expect(
      getCachedAnalysis(OWNER, REPO, SHA, "interview")
    ).resolves.toBeNull();
  });

  it("treats Blob retrieval and stream failures as cache misses", async () => {
    process.env.BLOB_READ_WRITE_TOKEN = "test-token";
    blobMocks.get.mockRejectedValueOnce(new Error("store unavailable"));

    await expect(
      getCachedAnalysis(OWNER, REPO, SHA, "interview")
    ).resolves.toBeNull();

    blobMocks.get.mockResolvedValueOnce({
      statusCode: 200,
      stream: new ReadableStream({
        pull(controller) {
          controller.error(new Error("stream unavailable"));
        },
      }),
    });
    await expect(
      getCachedAnalysis(OWNER, REPO, SHA, "interview")
    ).resolves.toBeNull();
  });

  it("writes private Blob cache entries with and without a static token", async () => {
    process.env.BLOB_READ_WRITE_TOKEN = "test-token";
    blobMocks.put.mockResolvedValue({});

    await putCachedAnalysis(OWNER, REPO, SHA, report(), "interview");
    expect(blobMocks.put).toHaveBeenLastCalledWith(
      `analysis-cache/${analysisCacheKey(OWNER, REPO, SHA)}.json`,
      expect.stringContaining(`"cached_at":"2026-07-23T00:00:00.000Z"`),
      {
        access: "private",
        contentType: "application/json",
        allowOverwrite: true,
        token: "test-token",
      }
    );

    delete process.env.BLOB_READ_WRITE_TOKEN;
    process.env.VERCEL = "1";
    process.env.BLOB_STORE_ID = "store_test";
    await putCachedAnalysis(OWNER, REPO, SHA, report(), "interview");
    expect(blobMocks.put).toHaveBeenLastCalledWith(
      expect.any(String),
      expect.any(String),
      {
        access: "private",
        contentType: "application/json",
        allowOverwrite: true,
      }
    );
  });

  it("uses a unique temporary file and removes it when atomic rename fails", async () => {
    useFilesystem();
    vi.spyOn(fs.promises, "rename").mockRejectedValueOnce(
      new Error("rename unavailable")
    );

    await expect(
      putCachedAnalysis(OWNER, REPO, SHA, report(), "interview")
    ).rejects.toThrow("rename unavailable");
    expect(fs.readdirSync(cacheDir!)).toEqual([]);
  });
});
