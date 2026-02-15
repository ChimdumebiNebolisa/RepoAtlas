/**
 * Repo ingest: GitHub clone and zip extraction.
 */

import { exec } from "child_process";
import fs from "fs";
import path from "path";
import { promisify } from "util";
import { randomUUID } from "crypto";
import os from "os";

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
  throw new Error("INVALID_INPUT: Provide githubUrl or zipRef");
}

async function ingestFromGithub(githubUrl: string): Promise<IngestResult> {
  const parsed = validateGithubUrl(githubUrl);
  if (!parsed) {
    throw new Error("INVALID_URL");
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
    throw new Error("CLONE_FAILED: " + (err instanceof Error ? err.message : "Unknown error"));
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
    throw new Error("ZIP_NOT_FOUND");
  }

  return {
    path: fullPath,
    name: path.basename(fullPath, path.extname(fullPath)),
    branch: null,
    cloneHash: null,
  };
}
