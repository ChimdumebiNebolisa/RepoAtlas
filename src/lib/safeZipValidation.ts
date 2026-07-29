import fs from "fs";
import path from "path";
import { AppError, ERROR_CODES } from "@/lib/errors";

const ZIP_MAGIC = [0x50, 0x4b];

function invalidZip(message: string): AppError {
  return new AppError({
    code: ERROR_CODES.ZIP_INVALID,
    status: 400,
    message,
  });
}

export function validateZipMagic(buffer: Buffer): void {
  if (buffer.length < 2 || buffer[0] !== ZIP_MAGIC[0] || buffer[1] !== ZIP_MAGIC[1]) {
    throw invalidZip("Invalid or corrupted zip file.");
  }
}

export function validateZipMagicFile(zipPath: string): void {
  const fd = fs.openSync(zipPath, "r");
  try {
    const header = Buffer.alloc(2);
    const bytesRead = fs.readSync(fd, header, 0, 2, 0);
    if (bytesRead < 2 || header[0] !== ZIP_MAGIC[0] || header[1] !== ZIP_MAGIC[1]) {
      throw invalidZip("Invalid or corrupted zip file.");
    }
  } finally {
    fs.closeSync(fd);
  }
}

export function resolveSafeZipEntryPath(extractRoot: string, entryName: string): string {
  const normalized = entryName.replace(/\\/g, "/");
  if (normalized.startsWith("/") || /^[a-zA-Z]:/.test(normalized)) {
    throw invalidZip("Zip entry contains an absolute path.");
  }

  const segments = normalized.split("/").filter((segment) => segment.length > 0 && segment !== ".");
  if (segments.length === 0) {
    throw invalidZip("Zip entry has an empty path.");
  }
  if (segments.some((segment) => segment === "..")) {
    throw invalidZip("Zip entry contains path traversal.");
  }

  const resolved = path.resolve(extractRoot, ...segments);
  const rootResolved = path.resolve(extractRoot);
  if (!resolved.startsWith(rootResolved + path.sep) && resolved !== rootResolved) {
    throw invalidZip("Zip entry escapes extraction root.");
  }
  if (resolved === rootResolved) {
    throw invalidZip("Zip entry has an empty path.");
  }
  return resolved;
}
