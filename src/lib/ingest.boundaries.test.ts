import { afterEach, describe, expect, it, vi } from "vitest";
import AdmZip from "adm-zip";
import fs from "fs";
import os from "os";
import path from "path";
import { AppError } from "./errors";
import { ingestRepo } from "./ingest";
import {
  downloadArchiveToFile,
  mapGithubApiError,
  resolveCommitSha,
  resolveDefaultBranch,
  wrapGithubNetworkError,
} from "./ingestGithubTransport";
import { getUploadedRepoName } from "./ingestInput";
import {
  createTemporaryWorkspace,
  findExtractedRepoRoot,
  removeWorkspace,
} from "./ingestWorkspace";

const temporaryPaths = new Set<string>();
const originalFetch = global.fetch;

function tempPath(name: string): string {
  const value = fs.mkdtempSync(path.join(os.tmpdir(), `repoatlas-test-${name}-`));
  temporaryPaths.add(value);
  return value;
}

function response(
  status: number,
  options: { body?: unknown; json?: unknown; headers?: Record<string, string>; url?: string } = {}
): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    url: options.url ?? "https://codeload.github.com/octocat/demo/archive.zip",
    headers: new Headers(options.headers),
    body: options.body ?? null,
    json: async () => options.json ?? {},
  } as Response;
}

function zipBuffer(entries: Record<string, string>): Buffer {
  const archive = new AdmZip();
  for (const [name, contents] of Object.entries(entries)) {
    archive.addFile(name, Buffer.from(contents));
  }
  return archive.toBuffer();
}

afterEach(async () => {
  global.fetch = originalFetch;
  vi.restoreAllMocks();
  for (const dir of temporaryPaths) {
    await fs.promises.rm(dir, { recursive: true, force: true });
  }
  temporaryPaths.clear();
});

describe("ZIP ingestion", () => {
  it("returns internal directories without creating a disposable workspace", async () => {
    const repoDir = tempPath("directory");
    fs.writeFileSync(path.join(repoDir, "README.md"), "# Demo");

    const result = await ingestRepo({ kind: "zip", zipRef: repoDir, zipName: "Portfolio.zip" });

    expect(result).toMatchObject({
      path: repoDir,
      name: "Portfolio",
      branch: null,
      cloneHash: null,
    });
    expect(result.cleanup).toBeUndefined();
  });

  it("extracts ZIPs, identifies a single root, and removes its workspace", async () => {
    const sourceDir = tempPath("source");
    const archivePath = path.join(sourceDir, "upload.zip");
    fs.writeFileSync(
      archivePath,
      zipBuffer({ "demo-main/README.md": "# Demo", "demo-main/src/index.ts": "export {};" })
    );

    const result = await ingestRepo({ kind: "zip", zipRef: archivePath, zipName: "Ignored.zip" });
    expect(result.name).toBe("demo-main");
    expect(fs.existsSync(path.join(result.path, "README.md"))).toBe(true);

    await result.cleanup?.();
    expect(fs.existsSync(result.path)).toBe(false);
  });

  it("uses the upload name for archives with multiple roots", async () => {
    const sourceDir = tempPath("multi-root");
    const archivePath = path.join(sourceDir, "upload.zip");
    fs.writeFileSync(
      archivePath,
      zipBuffer({ "README.md": "# Demo", "src/index.ts": "export {};" })
    );

    const result = await ingestRepo({ kind: "zip", zipRef: archivePath, zipName: "My repo.zip" });
    try {
      expect(result.name).toBe("My repo");
      expect(result.path).not.toContain("My repo");
    } finally {
      await result.cleanup?.();
    }
  });

  it("rejects aborted, missing, oversized, and invalid ZIP inputs", async () => {
    const aborted = new AbortController();
    aborted.abort();
    await expect(
      ingestRepo({ kind: "zip", zipRef: "/tmp/unused.zip" }, { signal: aborted.signal })
    ).rejects.toMatchObject({ code: "TIMEOUT", status: 504 });

    await expect(
      ingestRepo({ kind: "zip", zipRef: "/definitely/missing/repoatlas.zip" })
    ).rejects.toMatchObject({ code: "ZIP_NOT_FOUND", status: 404 });

    const sourceDir = tempPath("invalid");
    const invalidPath = path.join(sourceDir, "broken.zip");
    fs.writeFileSync(invalidPath, "not a zip");
    await expect(ingestRepo({ kind: "zip", zipRef: invalidPath })).rejects.toMatchObject({
      code: "ZIP_INVALID",
      status: 400,
    });

    const oversizedPath = path.join(sourceDir, "large.zip");
    fs.writeFileSync(oversizedPath, "x");
    vi.spyOn(fs, "statSync").mockReturnValueOnce({
      isFile: () => true,
      size: 101 * 1024 * 1024,
    } as fs.Stats);
    await expect(ingestRepo({ kind: "zip", zipRef: oversizedPath })).rejects.toMatchObject({
      code: "REPO_TOO_LARGE",
      status: 413,
    });
  });
});

describe("workspace cleanup", () => {
  it("creates workspaces, resolves root shapes, and ignores cleanup failures", async () => {
    const workspace = createTemporaryWorkspace("-contract");
    temporaryPaths.add(workspace);
    fs.mkdirSync(path.join(workspace, "only-root"));
    expect(findExtractedRepoRoot(workspace)).toEqual({
      repoPath: path.join(workspace, "only-root"),
      singleDir: "only-root",
    });
    fs.writeFileSync(path.join(workspace, "README.md"), "# Demo");
    expect(findExtractedRepoRoot(workspace)).toEqual({ repoPath: workspace, singleDir: null });

    vi.spyOn(fs.promises, "rm").mockRejectedValueOnce(new Error("locked"));
    await expect(removeWorkspace(workspace)).resolves.toBeUndefined();
  });
});

describe("GitHub transport error contracts", () => {
  it.each([
    [429, {}, "repo", "RATE_LIMITED", 429],
    [403, { "x-ratelimit-remaining": "0" }, "repo", "RATE_LIMITED", 429],
    [404, {}, "repo", "REPO_NOT_FOUND", 404],
    [404, {}, "ref", "MISSING_REF", 404],
    [403, { "x-ratelimit-remaining": "5" }, "repo", "REPO_PRIVATE", 403],
    [451, {}, "repo", "REPO_PRIVATE", 403],
    [422, {}, "ref", "MISSING_REF", 404],
    [500, {}, "repo", "CLONE_FAILED", 502],
  ] as const)("maps HTTP %s to %s", (status, headers, context, code, mappedStatus) => {
    expect(mapGithubApiError(response(status, { headers }), context)).toMatchObject({
      code,
      status: mappedStatus,
    });
  });

  it("preserves product errors and bounds network failures", () => {
    const productError = new AppError({ code: "MISSING_REF", status: 404, message: "missing" });
    expect(wrapGithubNetworkError(productError)).toBe(productError);
    expect(wrapGithubNetworkError(new Error("request aborted"))).toMatchObject({
      code: "DOWNLOAD_TIMEOUT",
      status: 504,
    });
    expect(wrapGithubNetworkError(new Error("socket timeout"))).toMatchObject({
      code: "DOWNLOAD_TIMEOUT",
    });
    expect(wrapGithubNetworkError("offline")).toMatchObject({
      code: "CLONE_FAILED",
      status: 502,
    });
  });

  it("uses the fallback default branch and rejects missing commit SHAs", async () => {
    global.fetch = vi
      .fn()
      .mockResolvedValueOnce(response(200, { json: {} }))
      .mockResolvedValueOnce(response(200, { json: {} })) as typeof global.fetch;

    await expect(resolveDefaultBranch("octocat", "demo")).resolves.toBe("main");
    await expect(resolveCommitSha("octocat", "demo", "main")).rejects.toMatchObject({
      code: "MISSING_REF",
      status: 404,
    });
  });

  it("maps API aborts and ordinary network errors", async () => {
    global.fetch = vi
      .fn()
      .mockRejectedValueOnce(new DOMException("This operation was aborted", "AbortError"))
      .mockRejectedValueOnce(new Error("network unavailable")) as typeof global.fetch;

    await expect(resolveDefaultBranch("octocat", "demo")).rejects.toMatchObject({
      code: "DOWNLOAD_TIMEOUT",
    });
    await expect(resolveCommitSha("octocat", "demo", "main")).rejects.toMatchObject({
      code: "CLONE_FAILED",
    });
  });

  it("rejects non-success, empty, and interrupted archive responses", async () => {
    const destinationDir = tempPath("download");
    const destination = path.join(destinationDir, "archive.zip");

    global.fetch = vi.fn().mockResolvedValueOnce(response(404)) as typeof global.fetch;
    await expect(
      downloadArchiveToFile("https://codeload.github.com/octocat/demo/archive.zip", destination)
    ).rejects.toMatchObject({ code: "MISSING_REF", status: 404 });

    global.fetch = vi.fn().mockResolvedValueOnce(response(500)) as typeof global.fetch;
    await expect(
      downloadArchiveToFile("https://codeload.github.com/octocat/demo/archive.zip", destination)
    ).rejects.toMatchObject({ code: "CLONE_FAILED", status: 502 });

    global.fetch = vi.fn().mockResolvedValueOnce(response(200)) as typeof global.fetch;
    await expect(
      downloadArchiveToFile("https://codeload.github.com/octocat/demo/archive.zip", destination)
    ).rejects.toMatchObject({ code: "CLONE_FAILED", status: 502 });

    let reads = 0;
    const interruptedBody = {
      getReader: () => ({
        read: async () => {
          reads += 1;
          if (reads === 1) return { done: false, value: new Uint8Array([1, 2, 3]) };
          throw new Error("connection aborted");
        },
        cancel: vi.fn(),
      }),
    };
    global.fetch = vi
      .fn()
      .mockResolvedValueOnce(response(200, { body: interruptedBody })) as typeof global.fetch;
    await expect(
      downloadArchiveToFile("https://codeload.github.com/octocat/demo/archive.zip", destination)
    ).rejects.toMatchObject({ code: "DOWNLOAD_TIMEOUT", status: 504 });
  });
});

describe("input naming", () => {
  it("bounds names to the final path segment and supplies a fallback", () => {
    expect(getUploadedRepoName("/tmp/repo.zip", "nested/Portfolio.zip")).toBe("Portfolio");
    expect(getUploadedRepoName("/tmp/.zip", "/")).toBe("uploaded-repo");
  });
});
