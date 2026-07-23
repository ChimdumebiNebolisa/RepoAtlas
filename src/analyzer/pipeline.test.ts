import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import { runIndexingPipeline } from "./pipeline";
import { MAX_DEPTH, MAX_FILE_COUNT } from "@/lib/ingestLimits";

let root: string;

function write(rel: string, contents: string): void {
  const full = path.join(root, rel);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, contents);
}

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), "pipeline-test-"));
});

afterEach(() => {
  vi.restoreAllMocks();
  fs.rmSync(root, { recursive: true, force: true });
});

function fileDirent(name: string): fs.Dirent {
  return {
    name,
    parentPath: root,
    path: root,
    isBlockDevice: () => false,
    isCharacterDevice: () => false,
    isDirectory: () => false,
    isFIFO: () => false,
    isFile: () => true,
    isSocket: () => false,
    isSymbolicLink: () => false,
  };
}

function fileStat(): fs.Stats {
  return {
    size: 1,
    isBlockDevice: () => false,
    isCharacterDevice: () => false,
    isDirectory: () => false,
    isFIFO: () => false,
    isFile: () => true,
    isSocket: () => false,
    isSymbolicLink: () => false,
  } as fs.Stats;
}

describe("runIndexingPipeline", () => {
  it("orders key docs deterministically with root docs first", async () => {
    write("packages/z/README.md", "# Z\n");
    write("packages/a/README.md", "# A\n");
    write("CONTRIBUTING.md", "# Contributing\n");
    write("README.md", "# Root\n");

    const result = await runIndexingPipeline(root);
    expect(result.key_docs).toEqual([
      "CONTRIBUTING.md",
      "README.md",
      "packages/a/README.md",
      "packages/z/README.md",
    ]);
  });

  it("orders CI evidence and indexed files independently of directory order", async () => {
    write("src/z.ts", "export const z = 1;\n");
    write("src/a.ts", "export const a = 1;\n");
    write(".github/workflows/z.yml", "name: z\n");
    write(".github/workflows/a.yml", "name: a\n");
    write("azure-pipelines.yml", "trigger: none\n");
    write("Jenkinsfile", "pipeline {}\n");

    const result = await runIndexingPipeline(root);
    expect(result.ci_configs).toEqual([
      ".github/workflows/a.yml",
      ".github/workflows/z.yml",
      "azure-pipelines.yml",
      "Jenkinsfile",
    ]);
    expect([...result.file_metadata.keys()]).toEqual([
      ".github/workflows/a.yml",
      ".github/workflows/z.yml",
      "src/a.ts",
      "src/z.ts",
      "Jenkinsfile",
      "azure-pipelines.yml",
    ].sort((a, b) => a.localeCompare(b)));
  });

  it("keeps usable files when a nested directory cannot be read", async () => {
    write("README.md", "# Root\n");
    write("src/index.ts", "export const ok = true;\n");
    fs.mkdirSync(path.join(root, "private"));
    const originalReaddir = fs.readdirSync.bind(fs);
    vi.spyOn(fs, "readdirSync").mockImplementation(((target: fs.PathLike, options?: unknown) => {
      if (path.resolve(String(target)) === path.join(root, "private")) {
        throw new Error("EACCES");
      }
      return originalReaddir(target, options as never);
    }) as typeof fs.readdirSync);

    const result = await runIndexingPipeline(root);

    expect(result.file_metadata.has("src/index.ts")).toBe(true);
    expect(result.warnings).toContain("1 unreadable directory was skipped.");
  });

  it("keeps usable files when one file cannot be inspected", async () => {
    write("src/good.ts", "export const ok = true;\n");
    write("src/unreadable.ts", "export const no = false;\n");
    const originalLstat = fs.lstatSync.bind(fs);
    vi.spyOn(fs, "lstatSync").mockImplementation(((target: fs.PathLike, options?: unknown) => {
      if (path.resolve(String(target)) === path.join(root, "src/unreadable.ts")) {
        throw new Error("EACCES");
      }
      return originalLstat(target, options as never);
    }) as typeof fs.lstatSync);

    const result = await runIndexingPipeline(root);

    expect([...result.file_metadata.keys()]).toEqual(["src/good.ts"]);
    expect(result.warnings).toContain("1 unreadable file was skipped.");
  });

  it("skips links instead of following them outside the workspace", async () => {
    const outsideRoot = fs.mkdtempSync(path.join(os.tmpdir(), "pipeline-outside-"));
    try {
      fs.writeFileSync(path.join(outsideRoot, "secret.ts"), "export const secret = true;\n");
      fs.writeFileSync(
        path.join(outsideRoot, "package.json"),
        JSON.stringify({ scripts: { stolen: "node outside.js" } })
      );
      fs.writeFileSync(path.join(outsideRoot, "README.md"), "```bash\nnpm run stolen\n```\n");
      fs.mkdirSync(path.join(outsideRoot, "nested"));
      fs.writeFileSync(
        path.join(outsideRoot, "nested", "also-secret.ts"),
        "export const secret = true;\n"
      );
      fs.symlinkSync(path.join(outsideRoot, "secret.ts"), path.join(root, "linked.ts"));
      fs.symlinkSync(path.join(outsideRoot, "nested"), path.join(root, "linked-dir"));
      fs.symlinkSync(path.join(outsideRoot, "package.json"), path.join(root, "package.json"));
      fs.symlinkSync(path.join(outsideRoot, "README.md"), path.join(root, "README.md"));
      write("src/index.ts", "export const safe = true;\n");

      const result = await runIndexingPipeline(root);

      expect([...result.file_metadata.keys()]).toEqual(["src/index.ts"]);
      expect((result.folder_map.children ?? []).map((child) => child.path)).toEqual(["src"]);
      expect(result.run_commands).toEqual([]);
      expect(result.warnings).toContain("4 unsafe filesystem entries were skipped.");
    } finally {
      fs.rmSync(outsideRoot, { recursive: true, force: true });
    }
  });

  it("rejects an escaped directory entry before inspecting it", async () => {
    const originalReaddir = fs.readdirSync.bind(fs);
    const lstat = vi.spyOn(fs, "lstatSync");
    vi.spyOn(fs, "readdirSync").mockImplementation(((target: fs.PathLike, options?: unknown) => {
      const entries = originalReaddir(target, options as never) as unknown as fs.Dirent[];
      if (path.resolve(String(target)) === root) {
        return [...entries, fileDirent("../outside.ts")];
      }
      return entries;
    }) as typeof fs.readdirSync);
    write("inside.ts", "export const safe = true;\n");

    const result = await runIndexingPipeline(root);

    expect([...result.file_metadata.keys()]).toEqual(["inside.ts"]);
    expect(lstat).not.toHaveBeenCalledWith(path.resolve(root, "../outside.ts"));
    expect(result.warnings).toContain("1 unsafe filesystem entry was skipped.");
  });

  it("accepts ordinary names that begin with two dots", async () => {
    write("..config.ts", "export const safe = true;\n");

    const result = await runIndexingPipeline(root);

    expect([...result.file_metadata.keys()]).toEqual(["..config.ts"]);
    expect(result.warnings).not.toContain("1 unsafe filesystem entry was skipped.");
  });

  it("ignores excluded directories and classifies unknown extensions safely", async () => {
    write("node_modules/ignored.ts", "throw new Error('not indexed');\n");
    write("dist/ignored.js", "throw new Error('not indexed');\n");
    write("src/schema.weird", "opaque\n");

    const result = await runIndexingPipeline(root);

    expect([...result.file_metadata.keys()]).toEqual(["src/schema.weird"]);
    expect(result.file_metadata.get("src/schema.weird")).toMatchObject({
      extension: ".weird",
      language: "unknown",
    });
  });

  it("warns instead of silently truncating deep folders", async () => {
    const deep = Array.from({ length: MAX_DEPTH + 2 }, (_, i) => `d${i}`).join("/");
    write(`${deep}/buried.md`, "# Buried\n");

    const result = await runIndexingPipeline(root);
    expect(result.warnings.some((w) => /truncated at depth/i.test(w))).toBe(true);
  });

  it("does not warn about truncation for shallow repositories", async () => {
    write("README.md", "# Root\n");
    write("src/index.ts", "export const x = 1;\n");

    const result = await runIndexingPipeline(root);
    expect(result.warnings.some((w) => /truncated at depth/i.test(w))).toBe(false);
  });

  it("warns when a depth-boundary directory is unreadable", async () => {
    const boundary = Array.from({ length: MAX_DEPTH }, (_, i) => `d${i}`).join("/");
    write(`${boundary}/buried.md`, "# Buried\n");
    const boundaryPath = path.join(root, boundary);
    const originalReaddir = fs.readdirSync.bind(fs);
    vi.spyOn(fs, "readdirSync").mockImplementation(((target: fs.PathLike, options?: unknown) => {
      if (path.resolve(String(target)) === boundaryPath) throw new Error("EACCES");
      return originalReaddir(target, options as never);
    }) as typeof fs.readdirSync);

    const result = await runIndexingPipeline(root);

    expect(result.warnings).toContain("1 unreadable directory was skipped.");
    expect(result.warnings.some((w) => /truncated at depth/i.test(w))).toBe(false);
  });

  it("warns only when the file-count limit actually omits metadata", async () => {
    const entries = Array.from({ length: MAX_FILE_COUNT + 1 }, (_, index) =>
      fileDirent(`file-${String(index).padStart(5, "0")}.ts`)
    );
    vi.spyOn(fs, "readdirSync").mockImplementation((() =>
      entries.slice(0, MAX_FILE_COUNT)) as unknown as typeof fs.readdirSync);
    vi.spyOn(fs, "lstatSync").mockImplementation(
      (() => fileStat()) as unknown as typeof fs.lstatSync
    );

    const exact = await runIndexingPipeline(root);
    expect(exact.file_metadata.size).toBe(MAX_FILE_COUNT);
    expect(exact.warnings).not.toContain("Max file count reached; some files omitted");

    vi.mocked(fs.readdirSync).mockImplementation(
      (() => entries) as unknown as typeof fs.readdirSync
    );
    const exceeded = await runIndexingPipeline(root);
    expect(exceeded.file_metadata.size).toBe(MAX_FILE_COUNT);
    expect(exceeded.warnings).toContain("Max file count reached; some files omitted");
  });

  it("passes command-extraction warnings through without inventing commands", async () => {
    const empty = await runIndexingPipeline(root);
    expect(empty.run_commands).toEqual([]);
    expect(empty.warnings).toContain(
      "No run commands detected from package.json, Makefile, or docs."
    );

    write("package.json", JSON.stringify({ scripts: { test: "vitest run" } }));
    const withCommand = await runIndexingPipeline(root);
    expect(withCommand.run_commands).toContainEqual({
      source: "package.json",
      command: "npm run test",
      description: "test",
    });
    expect(withCommand.warnings).not.toContain(
      "No run commands detected from package.json, Makefile, or docs."
    );
  });
});
