import fs from "fs";
import os from "os";
import path from "path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readFileHeaderSnippet, readSnippet } from "./snippets";

describe("evidence snippet reads", () => {
  let workspacePath: string;
  let outsidePath: string;

  beforeEach(() => {
    workspacePath = fs.mkdtempSync(path.join(os.tmpdir(), "repoatlas-snippets-"));
    outsidePath = fs.mkdtempSync(path.join(os.tmpdir(), "repoatlas-outside-"));
    fs.mkdirSync(path.join(workspacePath, "src"), { recursive: true });
    fs.writeFileSync(
      path.join(workspacePath, "src", "example.ts"),
      ["first line", "second line", "third line", "fourth line", "fifth line", "sixth line"].join(
        "\n"
      )
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
    fs.rmSync(workspacePath, { recursive: true, force: true });
    fs.rmSync(outsidePath, { recursive: true, force: true });
  });

  it("reads a bounded range and the standard file header", () => {
    expect(readSnippet(workspacePath, "src/example.ts", 2, 2)).toEqual({
      line_start: 2,
      line_end: 3,
      snippet: "second line\nthird line",
    });
    expect(readFileHeaderSnippet(workspacePath, "src/example.ts")).toEqual({
      line_start: 1,
      line_end: 5,
      snippet: "first line\nsecond line\nthird line\nfourth line\nfifth line",
    });
  });

  it("truncates long evidence without widening the line request", () => {
    fs.writeFileSync(
      path.join(workspacePath, "src", "long.ts"),
      `${"x".repeat(400)}\nnot included`
    );

    const result = readSnippet(workspacePath, "src/long.ts", 1, 1);

    expect(result).toEqual({
      line_start: 1,
      line_end: 1,
      snippet: `${"x".repeat(300)}…`,
    });
    expect(result?.snippet).toHaveLength(301);
  });

  it.each([
    "../outside.ts",
    "../../outside.ts",
    "/etc/passwd",
  ])("rejects an escaped or absolute path before source reads: %s", (relPath) => {
    const readSpy = vi.spyOn(fs, "readFileSync");

    expect(readSnippet(workspacePath, relPath)).toBeNull();
    expect(readSpy).not.toHaveBeenCalled();
  });

  it("does not read an existing file reached through parent traversal", () => {
    const outsideFile = path.join(outsidePath, "outside.ts");
    fs.writeFileSync(outsideFile, "outside secret");
    const escapedPath = path.relative(workspacePath, outsideFile);
    const readSpy = vi.spyOn(fs, "readFileSync");

    expect(readSnippet(workspacePath, escapedPath)).toBeNull();
    expect(readSpy).not.toHaveBeenCalled();
  });

  it("rejects linked files and linked parent directories", () => {
    fs.writeFileSync(path.join(outsidePath, "outside.ts"), "outside secret");
    fs.mkdirSync(path.join(outsidePath, "nested"));
    fs.writeFileSync(path.join(outsidePath, "nested", "source.ts"), "nested secret");
    fs.symlinkSync(
      path.join(outsidePath, "outside.ts"),
      path.join(workspacePath, "linked.ts")
    );
    fs.symlinkSync(
      path.join(outsidePath, "nested"),
      path.join(workspacePath, "linked-directory")
    );

    expect(readSnippet(workspacePath, "linked.ts")).toBeNull();
    expect(readSnippet(workspacePath, "linked-directory/source.ts")).toBeNull();
  });

  it.each([
    ".env",
    ".env.local",
    ".envrc",
    "config.secret.ts",
    "passwords.txt",
    "api-key.json",
    "nested/API_KEY.md",
  ])("rejects secret-like file names before source reads: %s", (relPath) => {
    const readSpy = vi.spyOn(fs, "readFileSync");

    expect(readSnippet(workspacePath, relPath)).toBeNull();
    expect(readSpy).not.toHaveBeenCalled();
  });

  it("returns no evidence for missing, directory, unreadable, or empty sources", () => {
    fs.mkdirSync(path.join(workspacePath, "src", "directory"));
    fs.writeFileSync(path.join(workspacePath, "src", "empty.ts"), " \n\t ");
    const originalRead = fs.readFileSync.bind(fs);
    vi.spyOn(fs, "readFileSync").mockImplementation(((file, ...args) => {
      if (String(file).endsWith("unreadable.ts")) {
        throw new Error("permission denied");
      }
      return originalRead(file, ...args);
    }) as typeof fs.readFileSync);
    fs.writeFileSync(path.join(workspacePath, "src", "unreadable.ts"), "source");

    expect(readSnippet(workspacePath, "src/missing.ts")).toBeNull();
    expect(readSnippet(workspacePath, "src/directory")).toBeNull();
    expect(readSnippet(workspacePath, "src/unreadable.ts")).toBeNull();
    expect(readSnippet(workspacePath, "src/empty.ts")).toBeNull();
  });

  it.each([
    [0, 1],
    [-1, 1],
    [1.5, 1],
    [Number.NaN, 1],
    [Number.POSITIVE_INFINITY, 1],
    [Number.MAX_SAFE_INTEGER + 1, 1],
    [1, 0],
    [1, -1],
    [1, 1.5],
    [1, Number.NaN],
    [1, Number.POSITIVE_INFINITY],
    [1, 6],
  ])(
    "rejects an invalid line request before source reads: start %s, count %s",
    (lineStart, lineCount) => {
      const readSpy = vi.spyOn(fs, "readFileSync");

      expect(
        readSnippet(workspacePath, "src/example.ts", lineStart, lineCount)
      ).toBeNull();
      expect(readSpy).not.toHaveBeenCalled();
    }
  );

  it("returns no evidence when the workspace is missing or the range is empty", () => {
    expect(readSnippet(path.join(workspacePath, "missing"), "src/example.ts")).toBeNull();
    expect(readSnippet(workspacePath, "src/example.ts", 20, 1)).toBeNull();
  });
});
