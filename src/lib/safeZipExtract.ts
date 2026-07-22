import fs from "fs";
import path from "path";
import { Transform } from "stream";
import { pipeline } from "stream/promises";
import yauzl from "yauzl";
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

function validateMagicFd(fd: number): void {
  const header = Buffer.alloc(2);
  const bytesRead = fs.readSync(fd, header, 0, 2, 0);
  if (bytesRead < 2 || header[0] !== ZIP_MAGIC[0] || header[1] !== ZIP_MAGIC[1]) {
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

function assertNoFileChildConflicts(
  plannedPaths: Map<string, boolean>,
  extractRoot: string
): void {
  const rootResolved = path.resolve(extractRoot);
  for (const [pathKey, isDirectory] of plannedPaths) {
    if (isDirectory) continue;
    let parentPath = path.dirname(pathKey);
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
}

type PlannedEntry = {
  entryName: string;
  targetPath: string;
  isDirectory: boolean;
  declaredSize: number;
};

function planEntry(
  extractRoot: string,
  entryName: string,
  isDirectory: boolean,
  declaredSize: number,
  plannedPaths: Map<string, boolean>,
  plannedEntries: PlannedEntry[],
  totals: { entries: number; uncompressed: number }
): void {
  totals.entries += 1;
  if (totals.entries > MAX_ENTRIES) {
    throw new AppError({
      code: ERROR_CODES.REPO_TOO_LARGE,
      status: 413,
      message: "Zip contains too many entries.",
    });
  }

  const targetPath = resolveSafeZipEntryPath(extractRoot, entryName);
  const pathKey = process.platform === "win32" ? targetPath.toLowerCase() : targetPath;
  if (plannedPaths.has(pathKey)) {
    throw new AppError({
      code: ERROR_CODES.ZIP_INVALID,
      status: 400,
      message: "Zip contains duplicate normalized paths.",
    });
  }
  plannedPaths.set(pathKey, isDirectory);
  plannedEntries.push({ entryName, targetPath, isDirectory, declaredSize });

  if (isDirectory) return;
  if (declaredSize > MAX_SINGLE_FILE_BYTES) {
    throw new AppError({
      code: ERROR_CODES.REPO_TOO_LARGE,
      status: 413,
      message: "Zip contains a file exceeding size limits.",
    });
  }
  totals.uncompressed += declaredSize;
  if (totals.uncompressed > MAX_UNCOMPRESSED_BYTES) {
    throw new AppError({
      code: ERROR_CODES.REPO_TOO_LARGE,
      status: 413,
      message: "Zip exceeds uncompressed size limit.",
    });
  }
}

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

function openReadStream(zipFile: yauzl.ZipFile, entry: yauzl.Entry): Promise<NodeJS.ReadableStream> {
  return new Promise((resolve, reject) => {
    zipFile.openReadStream(entry, (error, stream) => {
      if (error || !stream) {
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
      resolve(stream);
    });
  });
}

/**
 * Buffer-based extract kept for unit tests and small in-memory archives.
 * Production ingest uses {@link safeExtractZipFromFile} (streaming).
 */
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
  const plannedEntries: PlannedEntry[] = [];
  const plannedPaths = new Map<string, boolean>();
  const totals = { entries: 0, uncompressed: 0 };
  for (const entry of entries) {
    planEntry(
      extractRoot,
      entry.entryName,
      entry.isDirectory,
      entry.header.size,
      plannedPaths,
      plannedEntries,
      totals
    );
  }
  assertNoFileChildConflicts(plannedPaths, extractRoot);

  let actualUncompressed = 0;
  for (const planned of plannedEntries) {
    if (planned.isDirectory) {
      fs.mkdirSync(planned.targetPath, { recursive: true });
      continue;
    }
    fs.mkdirSync(path.dirname(planned.targetPath), { recursive: true });
    const entry = entries.find((item) => item.entryName === planned.entryName);
    if (!entry) {
      throw new AppError({
        code: ERROR_CODES.ZIP_INVALID,
        status: 400,
        message: "Invalid or corrupted zip file.",
      });
    }
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
    fs.writeFileSync(planned.targetPath, data);
  }
}

/**
 * Stream entries from a zip on disk without loading the whole archive into memory.
 */
export async function safeExtractZipFromFile(
  zipPath: string,
  extractRoot: string
): Promise<void> {
  const fd = fs.openSync(zipPath, "r");
  try {
    validateMagicFd(fd);
  } finally {
    fs.closeSync(fd);
  }

  fs.mkdirSync(extractRoot, { recursive: true });

  const scanner = await openZip(zipPath);
  let entries: yauzl.Entry[];
  try {
    entries = await readCentralDirectory(scanner);
  } finally {
    scanner.close();
  }

  const plannedEntries: PlannedEntry[] = [];
  const plannedPaths = new Map<string, boolean>();
  const totals = { entries: 0, uncompressed: 0 };
  for (const entry of entries) {
    planEntry(
      extractRoot,
      entry.fileName,
      /\/$/.test(entry.fileName),
      entry.uncompressedSize,
      plannedPaths,
      plannedEntries,
      totals
    );
  }
  assertNoFileChildConflicts(plannedPaths, extractRoot);

  const writer = await openZip(zipPath);
  const byName = new Map(plannedEntries.map((entry) => [entry.entryName, entry]));
  let actualUncompressed = 0;

  try {
    await new Promise<void>((resolve, reject) => {
      const fail = (error: unknown) => {
        try {
          writer.close();
        } catch {
          /* ignore */
        }
        reject(error);
      };

      writer.on("error", fail);
      writer.on("end", () => resolve());
      writer.on("entry", (entry: yauzl.Entry) => {
        const planned = byName.get(entry.fileName);
        if (!planned) {
          writer.readEntry();
          return;
        }
        if (planned.isDirectory) {
          fs.mkdirSync(planned.targetPath, { recursive: true });
          writer.readEntry();
          return;
        }

        void (async () => {
          try {
            fs.mkdirSync(path.dirname(planned.targetPath), { recursive: true });
            const readStream = await openReadStream(writer, entry);
            let entryBytes = 0;
            const counter = new Transform({
              transform(chunk, _encoding, callback) {
                const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
                entryBytes += buf.length;
                actualUncompressed += buf.length;
                if (entryBytes > MAX_SINGLE_FILE_BYTES) {
                  callback(
                    new AppError({
                      code: ERROR_CODES.REPO_TOO_LARGE,
                      status: 413,
                      message: "Zip contains a file exceeding size limits.",
                    })
                  );
                  return;
                }
                if (actualUncompressed > MAX_UNCOMPRESSED_BYTES) {
                  callback(
                    new AppError({
                      code: ERROR_CODES.REPO_TOO_LARGE,
                      status: 413,
                      message: "Zip exceeds uncompressed size limit.",
                    })
                  );
                  return;
                }
                callback(null, buf);
              },
            });
            await pipeline(readStream as NodeJS.ReadableStream, counter, fs.createWriteStream(planned.targetPath));
            writer.readEntry();
          } catch (error) {
            fail(error);
          }
        })();
      });
      writer.readEntry();
    });
  } catch (error) {
    try {
      writer.close();
    } catch {
      /* ignore */
    }
    throw error;
  }
}
