import fs from "fs";
import path from "path";
import AdmZip from "adm-zip";
import { AppError, ERROR_CODES } from "@/lib/errors";
import {
  MAX_ENTRIES,
  MAX_SINGLE_FILE_BYTES,
  MAX_UNCOMPRESSED_BYTES,
} from "@/lib/ingestLimits";

const ZIP_MAGIC = [0x50, 0x4b];

function validateMagic(buffer: Buffer): void {
  if (buffer.length < 2 || buffer[0] !== ZIP_MAGIC[0] || buffer[1] !== ZIP_MAGIC[1]) {
    throw new AppError({
      code: ERROR_CODES.ZIP_INVALID,
      status: 400,
      message: "Invalid or corrupted zip file.",
    });
  }
}

export function resolveSafeZipEntryPath(extractRoot: string, entryName: string): string {
  const normalized = entryName.replace(/\\/g, "/");
  if (normalized.startsWith("/") || /^[a-zA-Z]:/.test(normalized)) {
    throw new AppError({
      code: ERROR_CODES.ZIP_INVALID,
      status: 400,
      message: "Zip entry contains an absolute path.",
    });
  }
  const segments = normalized.split("/").filter((s) => s.length > 0);
  if (segments.some((s) => s === "..")) {
    throw new AppError({
      code: ERROR_CODES.ZIP_INVALID,
      status: 400,
      message: "Zip entry contains path traversal.",
    });
  }
  const resolved = path.resolve(extractRoot, ...segments);
  const rootResolved = path.resolve(extractRoot);
  if (!resolved.startsWith(rootResolved + path.sep) && resolved !== rootResolved) {
    throw new AppError({
      code: ERROR_CODES.ZIP_INVALID,
      status: 400,
      message: "Zip entry escapes extraction root.",
    });
  }
  return resolved;
}

export function safeExtractZip(buffer: Buffer, extractRoot: string): void {
  validateMagic(buffer);
  fs.mkdirSync(extractRoot, { recursive: true });

  let zip: AdmZip;
  try {
    zip = new AdmZip(buffer);
  } catch {
    throw new AppError({
      code: ERROR_CODES.ZIP_INVALID,
      status: 400,
      message: "Invalid or corrupted zip file.",
    });
  }

  const entries = zip.getEntries();
  if (entries.length > MAX_ENTRIES) {
    throw new AppError({
      code: ERROR_CODES.REPO_TOO_LARGE,
      status: 413,
      message: "Zip contains too many entries.",
    });
  }

  const plannedEntries: Array<{
    entry: (typeof entries)[number];
    targetPath: string;
  }> = [];
  const plannedPaths = new Map<string, boolean>();
  const rootResolved = path.resolve(extractRoot);
  let totalUncompressed = 0;
  for (const entry of entries) {
    const targetPath = resolveSafeZipEntryPath(extractRoot, entry.entryName);
    const pathKey = process.platform === "win32" ? targetPath.toLowerCase() : targetPath;
    if (plannedPaths.has(pathKey)) {
      throw new AppError({
        code: ERROR_CODES.ZIP_INVALID,
        status: 400,
        message: "Zip contains duplicate normalized paths.",
      });
    }
    plannedPaths.set(pathKey, entry.isDirectory);
    plannedEntries.push({ entry, targetPath });

    if (entry.isDirectory) continue;
    const size = entry.header.size;
    if (size > MAX_SINGLE_FILE_BYTES) {
      throw new AppError({
        code: ERROR_CODES.REPO_TOO_LARGE,
        status: 413,
        message: "Zip contains a file exceeding size limits.",
      });
    }
    totalUncompressed += size;
    if (totalUncompressed > MAX_UNCOMPRESSED_BYTES) {
      throw new AppError({
        code: ERROR_CODES.REPO_TOO_LARGE,
        status: 413,
        message: "Zip exceeds uncompressed size limit.",
      });
    }
  }

  for (const { entry, targetPath } of plannedEntries) {
    if (entry.isDirectory) continue;
    let parentPath = path.dirname(targetPath);
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
      const parentKey = process.platform === "win32" ? parentPath.toLowerCase() : parentPath;
      if (plannedPaths.get(parentKey) === false) {
        throw new AppError({
          code: ERROR_CODES.ZIP_INVALID,
          status: 400,
          message: "Zip contains conflicting normalized paths.",
        });
      }
      parentPath = path.dirname(parentPath);
    }
  }

  let actualUncompressed = 0;
  for (const { entry, targetPath } of plannedEntries) {
    if (entry.isDirectory) {
      fs.mkdirSync(targetPath, { recursive: true });
      continue;
    }
    fs.mkdirSync(path.dirname(targetPath), { recursive: true });
    const data = entry.getData();
    if (data.length > MAX_SINGLE_FILE_BYTES) {
      throw new AppError({
        code: ERROR_CODES.REPO_TOO_LARGE,
        status: 413,
        message: "Zip contains a file exceeding size limits.",
      });
    }
    actualUncompressed += data.length;
    if (actualUncompressed > MAX_UNCOMPRESSED_BYTES) {
      throw new AppError({
        code: ERROR_CODES.REPO_TOO_LARGE,
        status: 413,
        message: "Zip exceeds uncompressed size limit.",
      });
    }
    fs.writeFileSync(targetPath, data);
  }
}

export function safeExtractZipFromFile(zipPath: string, extractRoot: string): void {
  const buffer = fs.readFileSync(zipPath);
  safeExtractZip(buffer, extractRoot);
}
