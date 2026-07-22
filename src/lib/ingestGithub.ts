import fs from "fs";
import path from "path";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { isValidGitRef, parseGithubRepoUrl } from "@/lib/github";
import {
  downloadArchiveToFile,
  resolveCommitSha,
  resolveDefaultBranch,
} from "@/lib/ingestGithubTransport";
import type { IngestResult } from "@/lib/ingestTypes";
import {
  createTemporaryWorkspace,
  findExtractedRepoRoot,
  removeWorkspace,
} from "@/lib/ingestWorkspace";
import { safeExtractZipFromFile } from "@/lib/safeZipExtract";

export async function ingestFromGithub(
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
  if (signal?.aborted) {
    throw new AppError({
      code: ERROR_CODES.TIMEOUT,
      status: 504,
      message: "Analysis timed out.",
    });
  }

  const { owner, repo } = parsed;
  const branch =
    ref && `${ref}`.trim() !== ""
      ? `${ref}`.trim()
      : await resolveDefaultBranch(owner, repo);
  const sha = await resolveCommitSha(owner, repo, branch);
  const tempDir = createTemporaryWorkspace();
  const archivePath = path.join(tempDir, "archive.zip");

  try {
    const archiveUrl = `https://codeload.github.com/${owner}/${repo}/zip/${sha}`;
    await downloadArchiveToFile(archiveUrl, archivePath, signal);

    const extractDir = path.join(tempDir, "extracted");
    fs.mkdirSync(extractDir, { recursive: true });
    try {
      await safeExtractZipFromFile(archivePath, extractDir);
      await fs.promises.unlink(archivePath).catch(() => undefined);
    } catch (error) {
      if (error instanceof AppError) throw error;
      const message = error instanceof Error ? error.message : "Unknown error";
      throw new AppError({
        code: ERROR_CODES.ZIP_INVALID,
        status: 400,
        message: "Downloaded archive was invalid or corrupted.",
        meta: { rawMessage: message },
        cause: error,
      });
    }

    const { repoPath } = findExtractedRepoRoot(extractDir);
    return {
      path: repoPath,
      name: `${owner}/${repo}`,
      branch,
      cloneHash: sha,
      url: `https://github.com/${owner}/${repo}`,
      cleanup: () => removeWorkspace(tempDir),
    };
  } catch (error) {
    await removeWorkspace(tempDir);
    throw error;
  }
}
