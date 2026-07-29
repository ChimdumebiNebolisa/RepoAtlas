import fs from "fs";
import path from "path";
import { Transform } from "stream";
import { pipeline } from "stream/promises";
import type AdmZip from "adm-zip";
import type yauzl from "yauzl";
import { AppError, ERROR_CODES } from "@/lib/errors";
import {
  MAX_SINGLE_FILE_BYTES,
  MAX_UNCOMPRESSED_BYTES,
} from "@/lib/ingestLimits";
import type { PlannedZipEntry } from "@/lib/safeZipPlan";

function invalidZip(cause?: unknown): AppError {
  return new AppError({
    code: ERROR_CODES.ZIP_INVALID,
    status: 400,
    message: "Invalid or corrupted zip file.",
    cause,
  });
}

function managedPaths(extractRoot: string, entries: PlannedZipEntry[]): string[] {
  const rootResolved = path.resolve(extractRoot);
  const paths = new Set<string>();
  for (const entry of entries) {
    let current = entry.targetPath;
    while (current !== rootResolved && current.startsWith(rootResolved + path.sep)) {
      paths.add(current);
      current = path.dirname(current);
    }
  }
  return [...paths].sort((left, right) => right.length - left.length);
}

function extractionBaseline(extractRoot: string, entries: PlannedZipEntry[]): Set<string> {
  return new Set(managedPaths(extractRoot, entries).filter((targetPath) => fs.existsSync(targetPath)));
}

function removeCreatedPaths(
  extractRoot: string,
  entries: PlannedZipEntry[],
  baseline: Set<string>
): void {
  for (const targetPath of managedPaths(extractRoot, entries)) {
    if (!baseline.has(targetPath)) {
      fs.rmSync(targetPath, { recursive: true, force: true });
    }
  }
}

export function writeBufferedZip(
  zip: AdmZip,
  extractRoot: string,
  entries: PlannedZipEntry[]
): void {
  const entriesByName = new Map(zip.getEntries().map((entry) => [entry.entryName, entry]));
  const baseline = extractionBaseline(extractRoot, entries);
  let actualUncompressed = 0;

  try {
    for (const planned of entries) {
      if (planned.isDirectory) {
        fs.mkdirSync(planned.targetPath, { recursive: true });
        continue;
      }
      fs.mkdirSync(path.dirname(planned.targetPath), { recursive: true });
      const entry = entriesByName.get(planned.entryName);
      if (!entry) throw invalidZip();

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
  } catch (error) {
    removeCreatedPaths(extractRoot, entries, baseline);
    throw error;
  }
}

function openReadStream(
  zipFile: yauzl.ZipFile,
  entry: yauzl.Entry
): Promise<NodeJS.ReadableStream> {
  return new Promise((resolve, reject) => {
    zipFile.openReadStream(entry, (error, stream) => {
      if (error || !stream) {
        reject(invalidZip(error ?? undefined));
        return;
      }
      resolve(stream);
    });
  });
}

export async function writeStreamingZip(
  writer: yauzl.ZipFile,
  extractRoot: string,
  entries: PlannedZipEntry[]
): Promise<void> {
  const byName = new Map(entries.map((entry) => [entry.entryName, entry]));
  const baseline = extractionBaseline(extractRoot, entries);
  let actualUncompressed = 0;
  let settled = false;

  try {
    await new Promise<void>((resolve, reject) => {
      const fail = (error: unknown) => {
        if (settled) return;
        settled = true;
        reject(error);
      };
      const succeed = () => {
        if (settled) return;
        settled = true;
        resolve();
      };

      writer.on("error", fail);
      writer.on("end", succeed);
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
                const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
                entryBytes += buffer.length;
                actualUncompressed += buffer.length;
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
                callback(null, buffer);
              },
            });
            await pipeline(
              readStream as NodeJS.ReadableStream,
              counter,
              fs.createWriteStream(planned.targetPath)
            );
            writer.readEntry();
          } catch (error) {
            fail(error);
          }
        })();
      });
      writer.readEntry();
    });
  } catch (error) {
    removeCreatedPaths(extractRoot, entries, baseline);
    throw error;
  } finally {
    try {
      writer.close();
    } catch {
      /* ignore */
    }
  }
}
