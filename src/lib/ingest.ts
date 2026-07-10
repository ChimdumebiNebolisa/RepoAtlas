/**
 * Repo ingest: ZIP extraction and public GitHub archive download.
 *
 * Two supported inputs (discriminated):
 *   - { kind: "zip",    zipRef, zipName? }  — server-side path to an uploaded
 *     zip (or, for internal/test/sample flows, a directory). NEVER accept a
 *     caller-controlled filesystem path from the network; the API layer only
 *     passes server-created temp paths and server-owned fixture paths here.
 *   - { kind: "github", githubUrl, ref? }  — a canonical public GitHub URL.
 *
 * Security properties:
 *   - GitHub requests are ALWAYS unauthenticated. We never attach a server
 *     GITHUB_TOKEN when fetching a user-supplied repository, so an
 *     unauthenticated caller can never use privileged server access to read a
 *     private repository (Phase 1 finding B).
 *   - We resolve the requested branch/default branch to an exact commit SHA
 *     BEFORE downloading, then download and record that exact SHA (finding C).
 *   - The archive is streamed to a temp file with a hard compressed-byte cap so
 *     it is never buffered unbounded in memory (finding D).
 *   - Redirects are only followed to known GitHub hosts (redirect policy).
 *   - Temp directories are cleaned up on success, failure, and cancellation.
 */

import fs from "fs";
import path from "path";
import { randomUUID } from "crypto";
import os from "os";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { safeExtractZipFromFile } from "@/lib/safeZipExtract";
import { parseGithubRepoUrl, isValidGitRef, repoApiBase } from "@/lib/github";
import {
  DOWNLOAD_TIMEOUT_MS,
  GITHUB_API_TIMEOUT_MS,
  MAX_COMPRESSED_BYTES,
  maxCompressedBytesForZipUpload,
} from "@/lib/ingestLimits";

// Legacy permissive parser retained for internal owner/repo extraction
// (e.g. commit-history churn). Not on the request-validation path.
const GITHUB_URL_RE =
  /^https?:\/\/github\.com\/([a-zA-Z0-9_-]+)\/([a-zA-Z0-9_.-]+?)(?:\.git)?(?:\/(?:tree|blob)\/([^/]+))?\/?$/;

const ALLOWED_DOWNLOAD_HOSTS = new Set([
  "github.com",
  "codeload.github.com",
  "objects.githubusercontent.com",
]);

export interface IngestResult {
  path: string;
  name: string;
  branch: string | null;
  cloneHash: string | null;
  url?: string;
  cleanup?: () => Promise<void>;
}

export type IngestInput =
  | { kind: "zip"; zipRef: string; zipName?: string }
  | { kind: "github"; githubUrl: string; ref?: string };

/** Loose shape used by internal callers/tests (normalized before use). */
export interface LooseIngestInput {
  kind?: "zip" | "github";
  githubUrl?: string;
  ref?: string;
  zipRef?: string;
  zipName?: string;
}

export function validateGithubUrl(
  url: string
): { owner: string; repo: string; ref?: string } | null {
  const m = url.trim().match(GITHUB_URL_RE);
  if (!m) return null;
  const [, owner, repo, ref] = m;
  if (!owner || !repo) return null;
  return { owner, repo, ref: ref ?? undefined };
}

export function normalizeIngestInput(input: LooseIngestInput): IngestInput {
  const wantsGithub = input.kind === "github" || (!input.kind && !!input.githubUrl);
  if (wantsGithub) {
    if (!input.githubUrl) {
      throw new AppError({
        code: ERROR_CODES.INVALID_INPUT,
        status: 400,
        message: "Provide a GitHub repository URL.",
      });
    }
    return { kind: "github", githubUrl: input.githubUrl, ref: input.ref };
  }
  if (input.zipRef) {
    return { kind: "zip", zipRef: input.zipRef, zipName: input.zipName };
  }
  throw new AppError({
    code: ERROR_CODES.INVALID_INPUT,
    status: 400,
    message: "Provide a zip upload or a GitHub repository URL.",
  });
}

export async function ingestRepo(
  input: LooseIngestInput,
  opts?: { signal?: AbortSignal }
): Promise<IngestResult> {
  const normalized = normalizeIngestInput(input);
  if (normalized.kind === "github") {
    return ingestFromGithub(normalized.githubUrl, normalized.ref, opts?.signal);
  }
  return ingestFromZip(normalized.zipRef, normalized.zipName, opts?.signal);
}

function isAbortOrTimeout(msg: string): boolean {
  const lower = msg.toLowerCase();
  return (
    lower.includes("abort") ||
    lower.includes("timeout") ||
    lower.includes("timed out")
  );
}

async function githubApiFetch(url: string): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), GITHUB_API_TIMEOUT_MS);
  try {
    // NOTE: no Authorization header — public repositories only.
    return await fetch(url, {
      signal: controller.signal,
      headers: { Accept: "application/vnd.github+json" },
    });
  } finally {
    clearTimeout(timeoutId);
  }
}

/** Distinguish GitHub API HTTP failures into specific error codes. */
function mapGithubApiError(res: Response, context: "repo" | "ref"): AppError {
  const remaining = res.headers.get("x-ratelimit-remaining");
  const isRateLimited =
    res.status === 429 ||
    (res.status === 403 && remaining === "0");

  if (isRateLimited) {
    return new AppError({
      code: ERROR_CODES.RATE_LIMITED,
      status: 429,
      message: "GitHub rate limit reached. Try again later.",
      meta: { status: res.status },
    });
  }
  if (res.status === 404) {
    if (context === "ref") {
      return new AppError({
        code: ERROR_CODES.MISSING_REF,
        status: 404,
        message: "Requested branch or tag was not found.",
        meta: { status: res.status },
      });
    }
    // Unauthenticated GitHub returns 404 for both missing and private repos.
    return new AppError({
      code: ERROR_CODES.REPO_NOT_FOUND,
      status: 404,
      message: "Repository not found (it may be private).",
      meta: { status: res.status },
    });
  }
  if (res.status === 403 || res.status === 451) {
    return new AppError({
      code: ERROR_CODES.REPO_PRIVATE,
      status: 403,
      message: "Repository is not accessible (private or restricted).",
      meta: { status: res.status },
    });
  }
  if (res.status === 422) {
    return new AppError({
      code: ERROR_CODES.MISSING_REF,
      status: 404,
      message: "Requested branch or tag was not found.",
      meta: { status: res.status },
    });
  }
  return new AppError({
    code: ERROR_CODES.CLONE_FAILED,
    status: 502,
    message: "Could not fetch repository information from GitHub.",
    meta: { status: res.status },
  });
}

async function resolveDefaultBranch(owner: string, repo: string): Promise<string> {
  let res: Response;
  try {
    res = await githubApiFetch(repoApiBase(owner, repo));
  } catch (err) {
    throw wrapNetworkError(err);
  }
  if (!res.ok) throw mapGithubApiError(res, "repo");
  const data = (await res.json()) as { default_branch?: string; private?: boolean };
  if (data?.private) {
    throw new AppError({
      code: ERROR_CODES.REPO_PRIVATE,
      status: 403,
      message: "Repository is private.",
    });
  }
  return data?.default_branch ?? "main";
}

async function resolveCommitSha(
  owner: string,
  repo: string,
  ref: string
): Promise<string> {
  const url = `${repoApiBase(owner, repo)}/commits/${encodeURIComponent(ref)}`;
  let res: Response;
  try {
    res = await githubApiFetch(url);
  } catch (err) {
    throw wrapNetworkError(err);
  }
  if (!res.ok) throw mapGithubApiError(res, "ref");
  const data = (await res.json()) as { sha?: string };
  if (!data?.sha) {
    throw new AppError({
      code: ERROR_CODES.MISSING_REF,
      status: 404,
      message: "Could not resolve a commit for the requested ref.",
    });
  }
  return data.sha;
}

function wrapNetworkError(err: unknown): AppError {
  if (err instanceof AppError) return err;
  const msg = err instanceof Error ? err.message : "Unknown error";
  if (isAbortOrTimeout(msg)) {
    return new AppError({
      code: ERROR_CODES.DOWNLOAD_TIMEOUT,
      status: 504,
      message: "GitHub request timed out.",
      meta: { rawMessage: msg },
      cause: err,
    });
  }
  return new AppError({
    code: ERROR_CODES.CLONE_FAILED,
    status: 502,
    message: "Could not reach GitHub.",
    meta: { rawMessage: msg },
    cause: err,
  });
}

function writeChunk(stream: fs.WriteStream, chunk: Uint8Array): Promise<void> {
  return new Promise((resolve, reject) => {
    stream.write(chunk, (err) => (err ? reject(err) : resolve()));
  });
}

/**
 * Download an archive to a temp file. Follows redirects only to known GitHub
 * hosts and enforces the compressed-byte cap while streaming (never buffers the
 * whole archive in memory).
 */
async function downloadArchiveToFile(
  url: string,
  destFile: string,
  parentSignal?: AbortSignal
): Promise<void> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), DOWNLOAD_TIMEOUT_MS);
  if (parentSignal) {
    if (parentSignal.aborted) controller.abort();
    else parentSignal.addEventListener("abort", () => controller.abort(), { once: true });
  }
  try {
    let res: Response;
    try {
      res = await fetch(url, {
        signal: controller.signal,
        redirect: "follow",
        // NOTE: no Authorization header — public repositories only.
        headers: { Accept: "application/vnd.github+json" },
      });
    } catch (err) {
      throw wrapNetworkError(err);
    }

    // Redirect policy: the final resolved response must come from an allowed
    // GitHub host (github.com redirects archive downloads to codeload).
    try {
      const finalHost = new URL(res.url || url).hostname.toLowerCase();
      if (!ALLOWED_DOWNLOAD_HOSTS.has(finalHost)) {
        throw new AppError({
          code: ERROR_CODES.CLONE_FAILED,
          status: 502,
          message: "Archive download redirected to an unexpected host.",
          meta: { host: finalHost },
        });
      }
    } catch (err) {
      if (err instanceof AppError) throw err;
      // If res.url is missing/unparseable, proceed (initial URL is trusted).
    }

    if (!res.ok) {
      if (res.status === 404) {
        throw new AppError({
          code: ERROR_CODES.MISSING_REF,
          status: 404,
          message: "Archive not found for the resolved commit.",
          meta: { status: res.status },
        });
      }
      throw new AppError({
        code: ERROR_CODES.CLONE_FAILED,
        status: 502,
        message: "Could not download the repository archive.",
        meta: { status: res.status },
      });
    }

    const contentLength = res.headers.get("content-length");
    if (contentLength) {
      const size = parseInt(contentLength, 10);
      if (!Number.isNaN(size) && size > MAX_COMPRESSED_BYTES) {
        throw new AppError({
          code: ERROR_CODES.REPO_TOO_LARGE,
          status: 413,
          message: "Repository archive exceeds the size limit.",
          meta: { contentLength: size },
        });
      }
    }

    const body = res.body;
    if (!body) {
      throw new AppError({
        code: ERROR_CODES.CLONE_FAILED,
        status: 502,
        message: "Empty response body from GitHub archive download.",
      });
    }

    const out = fs.createWriteStream(destFile);
    const reader = body.getReader();
    let total = 0;
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        if (!value) continue;
        total += value.length;
        if (total > MAX_COMPRESSED_BYTES) {
          await reader.cancel().catch(() => undefined);
          throw new AppError({
            code: ERROR_CODES.REPO_TOO_LARGE,
            status: 413,
            message: "Repository archive exceeds the size limit.",
          });
        }
        await writeChunk(out, value);
      }
    } catch (err) {
      out.destroy();
      if (err instanceof AppError) throw err;
      throw wrapNetworkError(err);
    } finally {
      await new Promise<void>((resolve) => out.end(resolve));
    }
  } finally {
    clearTimeout(timeoutId);
  }
}

async function rmDir(dir: string): Promise<void> {
  try {
    await fs.promises.rm(dir, { recursive: true, force: true });
  } catch {
    /* ignore */
  }
}

async function ingestFromGithub(
  githubUrl: string,
  ref?: string,
  signal?: AbortSignal
): Promise<IngestResult> {
  const parsed = parseGithubRepoUrl(githubUrl);
  if (!parsed) {
    throw new AppError({
      code: ERROR_CODES.INVALID_URL,
      status: 400,
      message:
        "Enter a canonical GitHub repository URL like https://github.com/owner/repo.",
    });
  }
  if (ref !== undefined && ref !== null && `${ref}`.trim() !== "" && !isValidGitRef(ref)) {
    throw new AppError({
      code: ERROR_CODES.INVALID_URL,
      status: 400,
      message: "The provided branch or tag name is invalid.",
    });
  }

  if (signal?.aborted) throw new Error("Analysis aborted");

  const { owner, repo } = parsed;
  const name = `${owner}/${repo}`;
  const canonicalUrl = `https://github.com/${owner}/${repo}`;

  // 1) Resolve the branch to use (explicit ref or default branch).
  const branch =
    ref && `${ref}`.trim() !== "" ? `${ref}`.trim() : await resolveDefaultBranch(owner, repo);

  // 2) Resolve the exact commit SHA BEFORE downloading (finding C).
  const sha = await resolveCommitSha(owner, repo, branch);

  // 3) Download the archive for that exact SHA.
  const tempDir = path.join(os.tmpdir(), `repoatlas-${randomUUID()}`);
  fs.mkdirSync(tempDir, { recursive: true });
  const archivePath = path.join(tempDir, "archive.zip");

  try {
    const archiveUrl = `https://codeload.github.com/${owner}/${repo}/zip/${sha}`;
    await downloadArchiveToFile(archiveUrl, archivePath, signal);
  } catch (err) {
    await rmDir(tempDir);
    throw err;
  }

  // 4) Extract safely into the temp dir.
  const extractDir = path.join(tempDir, "extracted");
  try {
    fs.mkdirSync(extractDir, { recursive: true });
    safeExtractZipFromFile(archivePath, extractDir);
    await fs.promises.unlink(archivePath).catch(() => undefined);
  } catch (err) {
    await rmDir(tempDir);
    if (err instanceof AppError) throw err;
    const msg = err instanceof Error ? err.message : "Unknown error";
    throw new AppError({
      code: ERROR_CODES.ZIP_INVALID,
      status: 400,
      message: "Downloaded archive was invalid or corrupted.",
      meta: { rawMessage: msg },
      cause: err,
    });
  }

  const entries = fs.readdirSync(extractDir, { withFileTypes: true });
  const singleDir = entries.length === 1 && entries[0].isDirectory() ? entries[0].name : null;
  const repoPath = singleDir ? path.join(extractDir, singleDir) : extractDir;

  return {
    path: repoPath,
    name,
    branch,
    cloneHash: sha,
    url: canonicalUrl,
    cleanup: () => rmDir(tempDir),
  };
}

function getUploadedRepoName(zipPath: string, zipName?: string): string {
  const preferredName = zipName?.trim();
  const candidate = preferredName || path.basename(zipPath, path.extname(zipPath));
  return path.basename(candidate, path.extname(candidate)) || "uploaded-repo";
}

async function ingestFromZip(
  zipRef: string,
  zipName?: string,
  signal?: AbortSignal
): Promise<IngestResult> {
  if (signal?.aborted) throw new Error("Analysis aborted");
  const fullPath = path.resolve(zipRef);
  if (!fs.existsSync(fullPath)) {
    throw new AppError({
      code: ERROR_CODES.ZIP_NOT_FOUND,
      status: 404,
      message: "Zip path not found.",
      meta: { zipRef, fullPath },
    });
  }

  const stat = fs.statSync(fullPath);
  const isZipFile =
    stat.isFile() &&
    (fullPath.toLowerCase().endsWith(".zip") || path.extname(fullPath).toLowerCase() === ".zip");

  if (!isZipFile) {
    // Directory (internal/test/sample flow only — never a network-supplied path).
    return {
      path: fullPath,
      name: getUploadedRepoName(fullPath, zipName),
      branch: null,
      cloneHash: null,
    };
  }

  const size = stat.size;
  const zipCap = maxCompressedBytesForZipUpload();
  if (size > zipCap) {
    throw new AppError({
      code: ERROR_CODES.REPO_TOO_LARGE,
      status: 413,
      message: "Repository exceeds the size limit.",
      meta: { size },
    });
  }

  const tempDir = path.join(os.tmpdir(), `repoatlas-${randomUUID()}-extract`);
  fs.mkdirSync(tempDir, { recursive: true });

  try {
    safeExtractZipFromFile(fullPath, tempDir);
  } catch (err) {
    await rmDir(tempDir);
    if (err instanceof AppError) throw err;
    const msg = err instanceof Error ? err.message : "Unknown error";
    throw new AppError({
      code: ERROR_CODES.ZIP_INVALID,
      status: 400,
      message: "Could not extract the repository.",
      meta: { rawMessage: msg },
      cause: err,
    });
  }

  const entries = fs.readdirSync(tempDir, { withFileTypes: true });
  const singleDir = entries.length === 1 && entries[0].isDirectory() ? entries[0].name : null;
  const repoPath = singleDir ? path.join(tempDir, singleDir) : tempDir;
  const name = singleDir || getUploadedRepoName(fullPath, zipName);

  return {
    path: repoPath,
    name,
    branch: null,
    cloneHash: null,
    cleanup: () => rmDir(tempDir),
  };
}
