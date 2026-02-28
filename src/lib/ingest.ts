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

export function isRemoteBranchNotFoundMessage(message: string): boolean {
  const lower = message.toLowerCase();
  return lower.includes("remote branch") && lower.includes("not found");
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
  const requestedBranch = ref ?? null;
  const tempDir = path.join(os.tmpdir(), `repoatlas-${randomUUID()}`);
  fs.mkdirSync(tempDir, { recursive: true });

  const cloneUrl = `https://github.com/${owner}/${repo}.git`;
  const baseArgs = ["clone", "--depth", "1"] as const;
  const args = [...baseArgs];
  if (requestedBranch) args.push("--branch", requestedBranch);
  args.push(cloneUrl, tempDir);

  try {
    await execAsync(`git ${args.join(" ")}`, {
      timeout: CLONE_TIMEOUT_MS,
      maxBuffer: MAX_REPO_SIZE_BYTES,
    });
  } catch (err) {
    const originalMessage = err instanceof Error ? err.message : "Unknown error";
    // If the user pasted a tree/blob URL with a stale branch, retry default branch.
    if (requestedBranch && isRemoteBranchNotFoundMessage(originalMessage)) {
      try {
        await fs.promises.rm(tempDir, { recursive: true, force: true });
        await fs.promises.mkdir(tempDir, { recursive: true });
        await execAsync(`git ${[...baseArgs, cloneUrl, tempDir].join(" ")}`, {
          timeout: CLONE_TIMEOUT_MS,
          maxBuffer: MAX_REPO_SIZE_BYTES,
        });
      } catch {
        // Fall through to regular error classification using the original failure.
      }
      if (fs.existsSync(path.join(tempDir, ".git"))) {
        // Retry succeeded; continue with hash/branch detection below.
      } else {
        try {
          await fs.promises.rm(tempDir, { recursive: true, force: true });
        } catch {
          /* ignore */
        }
        throw new AppError({
          code: ERROR_CODES.CLONE_FAILED,
          status: 400,
          message: "Requested branch was not found in the repository.",
          meta: { rawMessage: originalMessage },
          cause: err,
        });
      }
    } else {
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
      if (isRemoteBranchNotFoundMessage(msg)) {
        throw new AppError({
          code: ERROR_CODES.CLONE_FAILED,
          status: 400,
          message: "Requested branch was not found in the repository.",
          meta: { rawMessage: msg },
          cause: err,
        });
      }
      if (
        lower.includes("repository not found") ||
        lower.includes("could not read username") ||
        lower.includes("authentication failed") ||
        lower.includes("permission denied") ||
        lower.includes("access denied") ||
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
  }

  const repoPath = tempDir;
  let cloneHash: string | null = null;
  let detectedBranch: string | null = requestedBranch;
  try {
    const { stdout } = await execAsync("git rev-parse HEAD", {
      cwd: repoPath,
      timeout: 5000,
    });
    cloneHash = stdout.trim() || null;
  } catch {
    /* optional */
  }
  try {
    const { stdout } = await execAsync("git rev-parse --abbrev-ref HEAD", {
      cwd: repoPath,
      timeout: 5000,
    });
    const value = stdout.trim();
    if (value && value !== "HEAD") {
      detectedBranch = value;
    }
  } catch {
    /* optional */
  }

  return {
    path: repoPath,
    name,
    branch: detectedBranch,
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
