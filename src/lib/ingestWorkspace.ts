import fs from "fs";
import os from "os";
import path from "path";
import { randomUUID } from "crypto";

export function createTemporaryWorkspace(suffix = ""): string {
  const tempDir = path.join(os.tmpdir(), `repoatlas-${randomUUID()}${suffix}`);
  fs.mkdirSync(tempDir, { recursive: true });
  return tempDir;
}

export async function removeWorkspace(dir: string): Promise<void> {
  try {
    await fs.promises.rm(dir, { recursive: true, force: true });
  } catch {
    // Cleanup is best-effort and must not replace the terminal product error.
  }
}

export function findExtractedRepoRoot(extractDir: string): {
  repoPath: string;
  singleDir: string | null;
} {
  const entries = fs.readdirSync(extractDir, { withFileTypes: true });
  const singleDir =
    entries.length === 1 && entries[0].isDirectory() ? entries[0].name : null;
  return {
    repoPath: singleDir ? path.join(extractDir, singleDir) : extractDir,
    singleDir,
  };
}
