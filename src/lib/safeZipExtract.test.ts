import { describe, expect, it } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import AdmZip from "adm-zip";
import { AppError } from "@/lib/errors";
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

function makeRawStoredZip(entries: Array<{ name: string; data: string }>): Buffer {
  const localParts: Buffer[] = [];
  const centralParts: Buffer[] = [];
  let offset = 0;

  for (const item of entries) {
    const name = Buffer.from(item.name, "utf8");
    const data = Buffer.from(item.data, "utf8");
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

describe("safeExtractZip", () => {
  it("rejects non-zip magic bytes", () => {
    withTempDir((extractRoot) => {
      expect(() => safeExtractZip(Buffer.from("not a zip"), extractRoot)).toThrow(AppError);
    });
  });

  it("rejects path traversal in entry names", () => {
    withTempDir((extractRoot) => {
      expect(() => resolveSafeZipEntryPath(extractRoot, "foo/../../outside.txt")).toThrow(
        AppError
      );
    });
  });

  it("rejects entries that resolve to the same normalized path before writing", () => {
    const buffer = makeRawStoredZip([
      { name: "src/./index.ts", data: "first" },
      { name: "src/index.ts", data: "second" },
    ]);
    withTempDir((extractRoot) => {
      expect(() => safeExtractZip(buffer, extractRoot)).toThrowError(
        expect.objectContaining({ code: "ZIP_INVALID" })
      );
      expect(fs.existsSync(path.join(extractRoot, "src"))).toBe(false);
    });
  });

  it("rejects file and child-path conflicts before writing", () => {
    const buffer = makeRawStoredZip([
      { name: "src", data: "not a directory" },
      { name: "src/index.ts", data: "export {};" },
    ]);
    withTempDir((extractRoot) => {
      expect(() => safeExtractZip(buffer, extractRoot)).toThrowError(
        expect.objectContaining({ code: "ZIP_INVALID" })
      );
      expect(fs.existsSync(path.join(extractRoot, "src"))).toBe(false);
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
    });
  }, 20_000);
});
