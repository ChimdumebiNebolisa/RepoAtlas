/**
 * Repo ingest: GitHub archive (zip) download and zip extraction.
 * Vercel-compatible: no git binary required.
 */

import AdmZip from "adm-zip";
import fs from "fs";
import path from "path";
import { randomUUID } from "crypto";
import os from "os";
import { AppError, ERROR_CODES } from "@/lib/errors";

const FETCH_TIMEOUT_MS = 60_000;
const MAX_REPO_SIZE_BYTES = 100 * 1024 * 1024; // 100MB

const GITHUB_URL_RE =
  /^https?:\/\/github\.com\/([a-zA-Z0-9_-]+)\/([a-zA-Z0-9_.-]+)(?:\.git)?(?:\/(?:tree|blob)\/([^/]+))?\/?$/;

export interface IngestResult {
  path: string;
  name: string;
  branch: string | null;
  cloneHash: string | null;
  cleanup?: () => Promise<void>;
}

export function validateGithubUrl(url: string): { owner: string; repo: string; ref?: string } | null {
  const m = url.trim().match(GITHUB_URL_RE);
  if (!m) return null;
  const [, owner, repo, ref] = m;
  if (!owner || !repo) return null;
  return { owner, repo, ref: ref ?? undefined };
}

function getAuthHeaders(): Record<string, string> {
  const token = process.env.GITHUB_TOKEN;
  if (token) {
    return { Authorization: `Bearer ${token}` };
  }
  return {};
}

async function getDefaultBranch(owner: string, repo: string): Promise<string> {
  const url = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15_000);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        Accept: "application/vnd.github.v3+json",
        ...getAuthHeaders(),
      },
    });
    if (!res.ok) {
      if (res.status === 404 || res.status === 403) {
        throw new AppError({
          code: ERROR_CODES.REPO_NOT_PUBLIC,
          status: 403,
          message: "Repository is private or not found.",
          meta: { status: res.status },
        });
      }
      throw new AppError({
        code: ERROR_CODES.CLONE_FAILED,
        status: 502,
        message: "Could not fetch repository info.",
        meta: { status: res.status },
      });
    }
    const data = (await res.json()) as { default_branch?: string };
    const branch = data?.default_branch ?? "main";
    return branch;
  } catch (err) {
    if (err instanceof AppError) throw err;
    const msg = err instanceof Error ? err.message : "Unknown error";
    if (msg.includes("abort") || msg.includes("timeout")) {
      throw new AppError({
        code: ERROR_CODES.CLONE_TIMEOUT,
        status: 504,
        message: "Cloning timed out.",
        meta: { rawMessage: msg },
        cause: err,
      });
    }
    throw new AppError({
      code: ERROR_CODES.CLONE_FAILED,
      status: 502,
      message: "Could not clone the repository.",
      meta: { rawMessage: msg },
      cause: err,
    });
  } finally {
    clearTimeout(timeoutId);
  }
}

async function getCommitSha(owner: string, repo: string, branch: string): Promise<string | null> {
  const url = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/commits/${encodeURIComponent(branch)}`;
  try {
    const res = await fetch(url, {
      headers: {
        Accept: "application/vnd.github.v3+json",
        ...getAuthHeaders(),
      },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { sha?: string };
    return data?.sha ?? null;
  } catch {
    return null;
  }
}

export async function ingestRepo(input: {
  githubUrl?: string;
  zipRef?: string;
}): Promise<IngestResult> {
  if (input.githubUrl) {
    return ingestFromGithub(input.githubUrl);
  }
  if (input.zipRef) {
    return ingestFromZip(input.zipRef);
  }
  throw new AppError({
    code: ERROR_CODES.INVALID_INPUT,
    status: 400,
    message: "Provide githubUrl or zipRef",
  });
}

async function ingestFromGithub(githubUrl: string): Promise<IngestResult> {
  const parsed = validateGithubUrl(githubUrl);
  if (!parsed) {
    throw new AppError({
      code: ERROR_CODES.INVALID_URL,
      status: 400,
      message: "Invalid GitHub URL",
    });
  }

  const { owner, repo, ref } = parsed;
  const name = `${owner}/${repo}`;

  const branch = ref ?? (await getDefaultBranch(owner, repo));
  const archiveUrl = `https://github.com/${owner}/${repo}/archive/refs/heads/${branch}.zip`;

  const tempDir = path.join(os.tmpdir(), `repoatlas-${randomUUID()}`);
  fs.mkdirSync(tempDir, { recursive: true });

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  let res: Response;
  try {
    res = await fetch(archiveUrl, {
      signal: controller.signal,
      redirect: "follow",
      headers: getAuthHeaders(),
    });
  } catch (err) {
    clearTimeout(timeoutId);
    try {
      await fs.promises.rm(tempDir, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
    const msg = err instanceof Error ? err.message : "Unknown error";
    const lower = msg.toLowerCase();
    if (lower.includes("abort") || lower.includes("timeout")) {
      throw new AppError({
        code: ERROR_CODES.CLONE_TIMEOUT,
        status: 504,
        message: "Cloning timed out.",
        meta: { rawMessage: msg },
        cause: err,
      });
    }
    throw new AppError({
      code: ERROR_CODES.CLONE_FAILED,
      status: 502,
      message: "Could not clone the repository.",
      meta: { rawMessage: msg },
      cause: err,
    });
  }
  clearTimeout(timeoutId);

  if (!res.ok) {
    try {
      await fs.promises.rm(tempDir, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
    if (res.status === 404 || res.status === 403) {
      if (ref) {
        throw new AppError({
          code: ERROR_CODES.CLONE_FAILED,
          status: 400,
          message: "Requested branch was not found in the repository.",
          meta: { status: res.status },
        });
      }
      throw new AppError({
        code: ERROR_CODES.REPO_NOT_PUBLIC,
        status: 403,
        message: "Repository is private or not found.",
        meta: { status: res.status },
      });
    }
    throw new AppError({
      code: ERROR_CODES.CLONE_FAILED,
      status: 502,
      message: "Could not clone the repository.",
      meta: { status: res.status },
    });
  }

  const contentLength = res.headers.get("content-length");
  if (contentLength) {
    const size = parseInt(contentLength, 10);
    if (!Number.isNaN(size) && size > MAX_REPO_SIZE_BYTES) {
      try {
        await fs.promises.rm(tempDir, { recursive: true, force: true });
      } catch {
        /* ignore */
      }
      throw new AppError({
        code: ERROR_CODES.REPO_TOO_LARGE,
        status: 413,
        message: "Repository exceeds the 100MB limit.",
        meta: { contentLength: size },
      });
    }
  }

  let buffer: ArrayBuffer;
  try {
    const reader = res.body;
    if (!reader) {
      throw new Error("No response body");
    }
    const chunks: Uint8Array[] = [];
    let total = 0;
    const streamReader = reader.getReader();
    for (;;) {
      const { done, value } = await streamReader.read();
      if (done) break;
      total += value.length;
      if (total > MAX_REPO_SIZE_BYTES) {
        streamReader.cancel();
        throw new AppError({
          code: ERROR_CODES.REPO_TOO_LARGE,
          status: 413,
          message: "Repository exceeds the 100MB limit.",
        });
      }
      chunks.push(value);
    }
    const length = chunks.reduce((sum, c) => sum + c.length, 0);
    buffer = new ArrayBuffer(length);
    const view = new Uint8Array(buffer);
    let offset = 0;
    for (const chunk of chunks) {
      view.set(chunk, offset);
      offset += chunk.length;
    }
  } catch (err) {
    try {
      await fs.promises.rm(tempDir, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
    if (err instanceof AppError) throw err;
    const msg = err instanceof Error ? err.message : "Unknown error";
    const lower = msg.toLowerCase();
    if (lower.includes("enomem") || lower.includes("memory")) {
      throw new AppError({
        code: ERROR_CODES.REPO_TOO_LARGE,
        status: 413,
        message: "Repository exceeds the 100MB limit.",
        meta: { rawMessage: msg },
        cause: err,
      });
    }
    throw new AppError({
      code: ERROR_CODES.CLONE_FAILED,
      status: 502,
      message: "Could not clone the repository.",
      meta: { rawMessage: msg },
      cause: err,
    });
  }

  try {
    const zip = new AdmZip(Buffer.from(buffer));
    zip.extractAllTo(tempDir, true);
  } catch (err) {
    try {
      await fs.promises.rm(tempDir, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
    const msg = err instanceof Error ? err.message : "Unknown error";
    throw new AppError({
      code: ERROR_CODES.CLONE_FAILED,
      status: 502,
      message: "Could not clone the repository.",
      meta: { rawMessage: msg },
      cause: err,
    });
  }

  const entries = fs.readdirSync(tempDir, { withFileTypes: true });
  const singleDir = entries.length === 1 && entries[0].isDirectory() ? entries[0].name : null;
  const repoPath = singleDir ? path.join(tempDir, singleDir) : tempDir;

  let cloneHash: string | null = null;
  try {
    cloneHash = await getCommitSha(owner, repo, branch);
  } catch {
    /* optional */
  }

  return {
    path: repoPath,
    name,
    branch,
    cloneHash,
    cleanup: async () => {
      try {
        await fs.promises.rm(tempDir, { recursive: true, force: true });
      } catch {
        /* ignore */
      }
    },
  };
}

async function ingestFromZip(zipRef: string): Promise<IngestResult> {
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
    return {
      path: fullPath,
      name: path.basename(fullPath, path.extname(fullPath)),
      branch: null,
      cloneHash: null,
    };
  }

  const size = stat.size;
  if (size > MAX_REPO_SIZE_BYTES) {
    throw new AppError({
      code: ERROR_CODES.REPO_TOO_LARGE,
      status: 413,
      message: "Repository exceeds the 100MB limit.",
      meta: { size },
    });
  }

  const tempDir = path.join(os.tmpdir(), `repoatlas-${randomUUID()}-extract`);
  fs.mkdirSync(tempDir, { recursive: true });

  try {
    const zip = new AdmZip(fullPath);
    zip.extractAllTo(tempDir, true);
  } catch (err) {
    try {
      await fs.promises.rm(tempDir, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
    const msg = err instanceof Error ? err.message : "Unknown error";
    throw new AppError({
      code: ERROR_CODES.CLONE_FAILED,
      status: 502,
      message: "Could not extract the repository.",
      meta: { rawMessage: msg },
      cause: err,
    });
  }

  const entries = fs.readdirSync(tempDir, { withFileTypes: true });
  const singleDir = entries.length === 1 && entries[0].isDirectory() ? entries[0].name : null;
  const repoPath = singleDir ? path.join(tempDir, singleDir) : tempDir;
  const name = path.basename(fullPath, path.extname(fullPath)) || "uploaded-repo";

  return {
    path: repoPath,
    name,
    branch: null,
    cloneHash: null,
    cleanup: async () => {
      try {
        await fs.promises.rm(tempDir, { recursive: true, force: true });
      } catch {
        /* ignore */
      }
    },
  };
}
