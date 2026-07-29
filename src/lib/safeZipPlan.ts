import path from "path";
import { AppError, ERROR_CODES } from "@/lib/errors";
import {
  MAX_ENTRIES,
  MAX_SINGLE_FILE_BYTES,
  MAX_UNCOMPRESSED_BYTES,
} from "@/lib/ingestLimits";
import { resolveSafeZipEntryPath } from "@/lib/safeZipValidation";

export type ZipEntryDescriptor = {
  entryName: string;
  isDirectory: boolean;
  declaredSize: number;
};

export type PlannedZipEntry = ZipEntryDescriptor & {
  targetPath: string;
};

function pathKey(targetPath: string): string {
  return process.platform === "win32" ? targetPath.toLowerCase() : targetPath;
}

function assertNoFileChildConflicts(
  plannedPaths: Map<string, boolean>,
  extractRoot: string
): void {
  const rootResolved = path.resolve(extractRoot);
  for (const [plannedPath, isDirectory] of plannedPaths) {
    if (isDirectory) continue;
    let parentPath = path.dirname(plannedPath);
    while (true) {
      const relativeParent = path.relative(rootResolved, parentPath);
      if (
        relativeParent.length === 0 ||
        relativeParent === ".." ||
        relativeParent.startsWith(`..${path.sep}`) ||
        path.isAbsolute(relativeParent)
      ) {
        break;
      }
      if (plannedPaths.get(pathKey(parentPath)) === false) {
        throw new AppError({
          code: ERROR_CODES.ZIP_INVALID,
          status: 400,
          message: "Zip contains conflicting normalized paths.",
        });
      }
      parentPath = path.dirname(parentPath);
    }
  }
}

export function planZipEntries(
  extractRoot: string,
  entries: ZipEntryDescriptor[]
): PlannedZipEntry[] {
  const plannedEntries: PlannedZipEntry[] = [];
  const plannedPaths = new Map<string, boolean>();
  let totalUncompressed = 0;

  for (const entry of entries) {
    if (plannedEntries.length + 1 > MAX_ENTRIES) {
      throw new AppError({
        code: ERROR_CODES.REPO_TOO_LARGE,
        status: 413,
        message: "Zip contains too many entries.",
      });
    }

    const targetPath = resolveSafeZipEntryPath(extractRoot, entry.entryName);
    const normalizedPath = pathKey(targetPath);
    if (plannedPaths.has(normalizedPath)) {
      throw new AppError({
        code: ERROR_CODES.ZIP_INVALID,
        status: 400,
        message: "Zip contains duplicate normalized paths.",
      });
    }

    plannedPaths.set(normalizedPath, entry.isDirectory);
    plannedEntries.push({ ...entry, targetPath });
    if (entry.isDirectory) continue;

    if (entry.declaredSize > MAX_SINGLE_FILE_BYTES) {
      throw new AppError({
        code: ERROR_CODES.REPO_TOO_LARGE,
        status: 413,
        message: "Zip contains a file exceeding size limits.",
      });
    }
    totalUncompressed += entry.declaredSize;
    if (totalUncompressed > MAX_UNCOMPRESSED_BYTES) {
      throw new AppError({
        code: ERROR_CODES.REPO_TOO_LARGE,
        status: 413,
        message: "Zip exceeds uncompressed size limit.",
      });
    }
  }

  assertNoFileChildConflicts(plannedPaths, extractRoot);
  return plannedEntries;
}
