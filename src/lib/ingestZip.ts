import fs from "fs";
import path from "path";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { getUploadedRepoName } from "@/lib/ingestInput";
import { maxCompressedBytesForZipUpload } from "@/lib/ingestLimits";
import type { IngestResult } from "@/lib/ingestTypes";
import {
  createTemporaryWorkspace,
  findExtractedRepoRoot,
  removeWorkspace,
} from "@/lib/ingestWorkspace";
import { safeExtractZipFromFile } from "@/lib/safeZipExtract";

export async function ingestFromZip(
  zipRef: string,
  zipName?: string,
  signal?: AbortSignal
): Promise<IngestResult> {
  if (signal?.aborted) {
    throw new AppError({
      code: ERROR_CODES.TIMEOUT,
      status: 504,
      message: "Analysis timed out.",
    });
  }

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
  const isZipFile = stat.isFile() && path.extname(fullPath).toLowerCase() === ".zip";
  if (!isZipFile) {
    return {
      path: fullPath,
      name: getUploadedRepoName(fullPath, zipName),
      branch: null,
      cloneHash: null,
    };
  }

  if (stat.size > maxCompressedBytesForZipUpload()) {
    throw new AppError({
      code: ERROR_CODES.REPO_TOO_LARGE,
      status: 413,
      message: "Repository exceeds the size limit.",
      meta: { size: stat.size },
    });
  }

  const tempDir = createTemporaryWorkspace("-extract");
  try {
    try {
      safeExtractZipFromFile(fullPath, tempDir);
    } catch (error) {
      if (error instanceof AppError) throw error;
      const message = error instanceof Error ? error.message : "Unknown error";
      throw new AppError({
        code: ERROR_CODES.ZIP_INVALID,
        status: 400,
        message: "Could not extract the repository.",
        meta: { rawMessage: message },
        cause: error,
      });
    }

    const { repoPath, singleDir } = findExtractedRepoRoot(tempDir);
    return {
      path: repoPath,
      name: singleDir || getUploadedRepoName(fullPath, zipName),
      branch: null,
      cloneHash: null,
      cleanup: () => removeWorkspace(tempDir),
    };
  } catch (error) {
    await removeWorkspace(tempDir);
    throw error;
  }
}
