/**
 * Repo ingest: GitHub clone and zip extraction.
 */

import { exec } from "child_process";
import fs from "fs";
import path from "path";
import { promisify } from "util";
import { randomUUID } from "crypto";
import os from "os";
import { AppError, ERROR_CODES } from "@/lib/errors";

const execAsync = promisify(exec);
const CLONE_TIMEOUT_MS = 60_000;
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
  const branch = ref ?? "main";
  const tempDir = path.join(os.tmpdir(), `repoatlas-${randomUUID()}`);
  fs.mkdirSync(tempDir, { recursive: true });

  const cloneUrl = `https://github.com/${owner}/${repo}.git`;
  const args = ["clone", "--depth", "1", "--branch", branch, cloneUrl, tempDir];

  try {
    await execAsync(`git ${args.join(" ")}`, {
      timeout: CLONE_TIMEOUT_MS,
      maxBuffer: MAX_REPO_SIZE_BYTES,
    });
  } catch (err) {
    try {
      await fs.promises.rm(tempDir, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
    const msg = err instanceof Error ? err.message : "Unknown error";
    const lower = msg.toLowerCase();
    if (lower.includes("maxbuffer") || lower.includes("max buffer") || lower.includes("enomem")) {
      throw new AppError({
        code: ERROR_CODES.REPO_TOO_LARGE,
        status: 413,
        message: "Repository exceeds the 100MB limit.",
        meta: { rawMessage: msg },
        cause: err,
      });
    }
    if (lower.includes("etimedout") || lower.includes("timeout") || lower.includes("timed out")) {
      throw new AppError({
        code: ERROR_CODES.CLONE_TIMEOUT,
        status: 504,
        message: "Cloning timed out.",
        meta: { rawMessage: msg },
        cause: err,
      });
    }
    if (
      lower.includes("repository not found") ||
      lower.includes("not found") ||
      lower.includes("could not read username") ||
      lower.includes("authentication failed") ||
      lower.includes("403") ||
      lower.includes("404")
    ) {
      throw new AppError({
        code: ERROR_CODES.REPO_NOT_PUBLIC,
        status: 403,
        message: "Repository is private or not found.",
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

  const repoPath = tempDir;
  let cloneHash: string | null = null;
  try {
    const { stdout } = await execAsync("git rev-parse HEAD", {
      cwd: repoPath,
      timeout: 5000,
    });
    cloneHash = stdout.trim() || null;
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

  return {
    path: fullPath,
    name: path.basename(fullPath, path.extname(fullPath)),
    branch: null,
    cloneHash: null,
  };
}
