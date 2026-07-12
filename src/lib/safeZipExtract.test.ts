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
