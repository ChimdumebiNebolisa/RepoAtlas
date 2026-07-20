import { describe, expect, it } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import AdmZip from "adm-zip";
import { AppError } from "@/lib/errors";
import {
  MAX_ENTRIES,
  MAX_SINGLE_FILE_BYTES,
  MAX_UNCOMPRESSED_BYTES,
} from "@/lib/ingestLimits";
import { safeExtractZip, resolveSafeZipEntryPath } from "./safeZipExtract";

function withTempDir(fn: (dir: string) => void): void {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "repoatlas-zip-test-"));
  try {
    fn(dir);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

function makeZip(entries: Array<{ name: string; data: string | Buffer }>): Buffer {
  const zip = new AdmZip();
  for (const entry of entries) {
    zip.addFile(entry.name, Buffer.isBuffer(entry.data) ? entry.data : Buffer.from(entry.data));
  }
  return zip.toBuffer();
}

function crc32(data: Buffer): number {
  let crc = 0xffffffff;
  for (const byte of data) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function makeRawStoredZip(entries: Array<{ name: string; data: string | Buffer }>): Buffer {
  const localParts: Buffer[] = [];
  const centralParts: Buffer[] = [];
  let offset = 0;

  for (const item of entries) {
    const name = Buffer.from(item.name, "utf8");
    const data = Buffer.isBuffer(item.data) ? item.data : Buffer.from(item.data, "utf8");
    const crc = crc32(data);
    const local = Buffer.alloc(30 + name.length + data.length);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(name.length, 26);
    name.copy(local, 30);
    data.copy(local, 30 + name.length);
    localParts.push(local);

    const central = Buffer.alloc(46 + name.length);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(data.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt32LE(offset, 42);
    name.copy(central, 46);
    centralParts.push(central);
    offset += local.length;
  }

  const localData = Buffer.concat(localParts);
  const centralData = Buffer.concat(centralParts);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralData.length, 12);
  end.writeUInt32LE(localData.length, 16);
  return Buffer.concat([localData, centralData, end]);
}

function expectExtractionRootToBeEmpty(extractRoot: string): void {
  expect(fs.readdirSync(extractRoot)).toEqual([]);
}

describe("safeExtractZip", () => {
  it("rejects non-zip magic bytes", () => {
    withTempDir((extractRoot) => {
      expect(() => safeExtractZip(Buffer.from("not a zip"), extractRoot)).toThrow(AppError);
      expectExtractionRootToBeEmpty(extractRoot);
    });
  });

  it("rejects path traversal in entry names", () => {
    const buffer = makeRawStoredZip([{ name: "foo/../../outside.txt", data: "unsafe" }]);
    withTempDir((extractRoot) => {
      expect(() => resolveSafeZipEntryPath(extractRoot, "foo/../../outside.txt")).toThrow(
        AppError
      );
      expect(() => safeExtractZip(buffer, extractRoot)).toThrowError(
        expect.objectContaining({ code: "ZIP_INVALID" })
      );
      expectExtractionRootToBeEmpty(extractRoot);
    });
  });

  it.each(["/etc/passwd", "C:\\Windows\\system32\\config", "\\\\server\\share\\file.txt"])(
    "rejects the absolute archive path %s before writing",
    (entryName) => {
      const buffer = makeRawStoredZip([{ name: entryName, data: "unsafe" }]);
      withTempDir((extractRoot) => {
        expect(() => safeExtractZip(buffer, extractRoot)).toThrowError(
          expect.objectContaining({ code: "ZIP_INVALID" })
        );
        expectExtractionRootToBeEmpty(extractRoot);
      });
    }
  );

  it("accepts an archive at the entry-count limit", () => {
    const buffer = makeRawStoredZip(
      Array.from({ length: MAX_ENTRIES }, (_, index) => ({
        name: `entry-${index}.txt`,
        data: "",
      }))
    );
    withTempDir((extractRoot) => {
      safeExtractZip(buffer, extractRoot);
      expect(fs.readdirSync(extractRoot)).toHaveLength(MAX_ENTRIES);
    });
  }, 20_000);

  it("rejects an archive over the entry-count limit before writing", () => {
    const buffer = makeRawStoredZip(
      Array.from({ length: MAX_ENTRIES + 1 }, (_, index) => ({
        name: `entry-${index}.txt`,
        data: "",
      }))
    );
    withTempDir((extractRoot) => {
      expect(() => safeExtractZip(buffer, extractRoot)).toThrowError(
        expect.objectContaining({ code: "REPO_TOO_LARGE" })
      );
      expectExtractionRootToBeEmpty(extractRoot);
    });
  }, 20_000);

  it("accepts a file at the per-file size limit", () => {
    const buffer = makeZip([
      { name: "at-limit.bin", data: Buffer.alloc(MAX_SINGLE_FILE_BYTES) },
    ]);
    withTempDir((extractRoot) => {
      safeExtractZip(buffer, extractRoot);
      expect(fs.statSync(path.join(extractRoot, "at-limit.bin")).size).toBe(
        MAX_SINGLE_FILE_BYTES
      );
    });
  }, 20_000);

  it("rejects a file over the per-file size limit before writing", () => {
    const buffer = makeZip([
      { name: "over-limit.bin", data: Buffer.alloc(MAX_SINGLE_FILE_BYTES + 1) },
    ]);
    withTempDir((extractRoot) => {
      expect(() => safeExtractZip(buffer, extractRoot)).toThrowError(
        expect.objectContaining({ code: "REPO_TOO_LARGE" })
      );
      expectExtractionRootToBeEmpty(extractRoot);
    });
  }, 20_000);

  it("accepts an archive at the total uncompressed size limit", () => {
    const atFileLimit = Buffer.alloc(MAX_SINGLE_FILE_BYTES);
    const buffer = makeZip(
      Array.from(
        { length: MAX_UNCOMPRESSED_BYTES / MAX_SINGLE_FILE_BYTES },
        (_, index) => ({ name: `part-${index}.bin`, data: atFileLimit })
      )
    );
    withTempDir((extractRoot) => {
      safeExtractZip(buffer, extractRoot);
      const extractedBytes = fs
        .readdirSync(extractRoot)
        .reduce((total, name) => total + fs.statSync(path.join(extractRoot, name)).size, 0);
      expect(extractedBytes).toBe(MAX_UNCOMPRESSED_BYTES);
    });
  }, 20_000);

  it("rejects an archive over the total uncompressed size limit before writing", () => {
    const atFileLimit = Buffer.alloc(MAX_SINGLE_FILE_BYTES);
    const buffer = makeZip([
      ...Array.from(
        { length: MAX_UNCOMPRESSED_BYTES / MAX_SINGLE_FILE_BYTES },
        (_, index) => ({ name: `part-${index}.bin`, data: atFileLimit })
      ),
      { name: "one-byte-over.bin", data: Buffer.alloc(1) },
    ]);
    withTempDir((extractRoot) => {
      expect(() => safeExtractZip(buffer, extractRoot)).toThrowError(
        expect.objectContaining({ code: "REPO_TOO_LARGE" })
      );
      expectExtractionRootToBeEmpty(extractRoot);
    });
  }, 20_000);

  it("rejects entries that resolve to the same normalized path before writing", () => {
    const buffer = makeRawStoredZip([
      { name: "src/./index.ts", data: "first" },
      { name: "src/index.ts", data: "second" },
    ]);
    withTempDir((extractRoot) => {
      expect(() => safeExtractZip(buffer, extractRoot)).toThrowError(
        expect.objectContaining({ code: "ZIP_INVALID" })
      );
      expectExtractionRootToBeEmpty(extractRoot);
    });
  });

  it.each([
    ["parent first", ["src", "src/index.ts"]],
    ["child first", ["src/index.ts", "src"]],
  ])("rejects file and child-path conflicts with the %s before writing", (_label, names) => {
    const buffer = makeRawStoredZip(
      names.map((name) => ({ name, data: name === "src" ? "not a directory" : "export {};" }))
    );
    withTempDir((extractRoot) => {
      expect(() => safeExtractZip(buffer, extractRoot)).toThrowError(
        expect.objectContaining({ code: "ZIP_INVALID" })
      );
      expectExtractionRootToBeEmpty(extractRoot);
    });
  });

  it("extracts valid zip entries into the root", () => {
    const buffer = makeZip([
      { name: "README.md", data: "# Hello" },
      { name: "src/index.ts", data: "export {};" },
    ]);
    withTempDir((extractRoot) => {
      safeExtractZip(buffer, extractRoot);
      expect(fs.readFileSync(path.join(extractRoot, "README.md"), "utf-8")).toBe("# Hello");
      expect(fs.existsSync(path.join(extractRoot, "src", "index.ts"))).toBe(true);
    });
  });

  it("rejects zip bombs over uncompressed limit", () => {
    const huge = Buffer.alloc(51 * 1024 * 1024, 0);
    const buffer = makeZip([{ name: "big.bin", data: huge }]);
    withTempDir((extractRoot) => {
      expect(() => safeExtractZip(buffer, extractRoot)).toThrow(AppError);
      expectExtractionRootToBeEmpty(extractRoot);
    });
  }, 20_000);
});
