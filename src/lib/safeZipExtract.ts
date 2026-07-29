import fs from "fs";
import AdmZip from "adm-zip";
import yauzl from "yauzl";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { planZipEntries } from "@/lib/safeZipPlan";
import {
  resolveSafeZipEntryPath,
  validateZipMagic,
  validateZipMagicFile,
} from "@/lib/safeZipValidation";
import { writeBufferedZip, writeStreamingZip } from "@/lib/safeZipWrite";

export { resolveSafeZipEntryPath };

function openZip(zipPath: string): Promise<yauzl.ZipFile> {
  return new Promise((resolve, reject) => {
    yauzl.open(zipPath, { lazyEntries: true, autoClose: false }, (error, opened) => {
      if (error || !opened) {
        reject(
          new AppError({
            code: ERROR_CODES.ZIP_INVALID,
            status: 400,
            message: "Invalid or corrupted zip file.",
            cause: error ?? undefined,
          })
        );
        return;
      }
      resolve(opened);
    });
  });
}

function readCentralDirectory(zipFile: yauzl.ZipFile): Promise<yauzl.Entry[]> {
  return new Promise((resolve, reject) => {
    const entries: yauzl.Entry[] = [];
    zipFile.on("error", reject);
    zipFile.on("entry", (entry: yauzl.Entry) => {
      entries.push(entry);
      zipFile.readEntry();
    });
    zipFile.on("end", () => resolve(entries));
    zipFile.readEntry();
  });
}

/**
 * Buffer-based extract kept for unit tests and small in-memory archives.
 * Production ingest uses {@link safeExtractZipFromFile} (streaming).
 */
export function safeExtractZip(buffer: Buffer, extractRoot: string): void {
  validateZipMagic(buffer);
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
  const plannedEntries = planZipEntries(
    extractRoot,
    entries.map((entry) => ({
      entryName: entry.entryName,
      isDirectory: entry.isDirectory,
      declaredSize: entry.header.size,
    }))
  );
  writeBufferedZip(zip, extractRoot, plannedEntries);
}

/**
 * Stream entries from a zip on disk without loading the whole archive into memory.
 */
export async function safeExtractZipFromFile(
  zipPath: string,
  extractRoot: string
): Promise<void> {
  validateZipMagicFile(zipPath);
  fs.mkdirSync(extractRoot, { recursive: true });

  const scanner = await openZip(zipPath);
  let entries: yauzl.Entry[];
  try {
    entries = await readCentralDirectory(scanner);
  } finally {
    scanner.close();
  }

  const plannedEntries = planZipEntries(
    extractRoot,
    entries.map((entry) => ({
      entryName: entry.fileName,
      isDirectory: /\/$/.test(entry.fileName),
      declaredSize: entry.uncompressedSize,
    }))
  );
  const writer = await openZip(zipPath);
  await writeStreamingZip(writer, extractRoot, plannedEntries);
}
