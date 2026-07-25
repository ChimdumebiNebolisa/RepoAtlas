import fs from "fs";
import os from "os";
import path from "path";
import ts from "typescript";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createCompilerResolver } from "./tsjsResolveCompiler";

function writeWorkspace(files: Record<string, string>): string {
  const workspace = fs.mkdtempSync(
    path.join(os.tmpdir(), "repoatlas-ts-compiler-")
  );
  for (const [relPath, content] of Object.entries(files)) {
    const fullPath = path.join(workspace, relPath);
    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
    fs.writeFileSync(fullPath, content, "utf-8");
  }
  return workspace;
}

function createResolver(
  workspacePath: string,
  indexedFiles: string[] = [],
  ignoredFiles: string[] = []
) {
  const indexed = new Set(indexedFiles);
  const ignored = new Set(ignoredFiles);
  return createCompilerResolver({
    workspacePath,
    isIgnored: (relPath) => ignored.has(relPath.replace(/\\/g, "/")),
    findIndexedFile: (relPath) =>
      indexed.has(relPath.replace(/\\/g, "/"))
        ? relPath.replace(/\\/g, "/")
        : null,
  });
}

describe("TypeScript compiler resolution boundaries", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("uses safe defaults when neither compiler configuration exists", () => {
    const workspace = writeWorkspace({
      "src/index.ts": "export {};\n",
      "src/utility.ts": "export const utility = true;\n",
    });
    try {
      const resolver = createResolver(workspace, [
        "src/index.ts",
        "src/utility.ts",
      ]);
      expect(resolver.warnings).toEqual([]);
      expect(resolver.resolve("src/index.ts", "./utility")).toEqual({
        status: "resolved_internal",
        relPath: "src/utility.ts",
      });
    } finally {
      fs.rmSync(workspace, { recursive: true, force: true });
    }
  });

  it("falls back to jsconfig aliases and ignores malformed aliases safely", () => {
    const valid = writeWorkspace({
      "jsconfig.json": JSON.stringify({
        compilerOptions: {
          baseUrl: ".",
          paths: { "@app/*": ["src/app/*"] },
        },
      }),
      "src/index.js": "export {};\n",
      "src/app/value.js": "export const value = true;\n",
    });
    const malformed = writeWorkspace({
      "tsconfig.json": JSON.stringify({
        compilerOptions: {
          baseUrl: ".",
          paths: { "@bad/*": "src/*" },
        },
      }),
      "src/index.ts": "export {};\n",
      "src/value.ts": "export const value = true;\n",
    });
    try {
      const validResolver = createResolver(valid, [
        "src/index.js",
        "src/app/value.js",
      ]);
      expect(validResolver.resolve("src/index.js", "@app/value")).toEqual({
        status: "resolved_internal",
        relPath: "src/app/value.js",
      });

      const malformedResolver = createResolver(malformed, [
        "src/index.ts",
        "src/value.ts",
      ]);
      expect(malformedResolver.warnings).toEqual([]);
      expect(malformedResolver.resolve("src/index.ts", "@bad/value")).toEqual({
        status: "unresolved",
        reason: "module_not_found",
      });
    } finally {
      fs.rmSync(valid, { recursive: true, force: true });
      fs.rmSync(malformed, { recursive: true, force: true });
    }
  });

  it("does not inherit compiler aliases from outside the analyzed repository", () => {
    const parent = fs.mkdtempSync(
      path.join(os.tmpdir(), "repoatlas-ts-compiler-parent-")
    );
    const workspace = path.join(parent, "repository");
    fs.mkdirSync(path.join(workspace, "src"), { recursive: true });
    fs.writeFileSync(path.join(workspace, "src/index.ts"), "export {};\n");
    fs.writeFileSync(
      path.join(workspace, "src/value.ts"),
      "export const value = true;\n"
    );
    fs.writeFileSync(
      path.join(parent, "tsconfig.json"),
      JSON.stringify({
        compilerOptions: {
          baseUrl: ".",
          paths: { "@parent": ["repository/src/value.ts"] },
        },
      })
    );
    try {
      const resolver = createResolver(workspace, [
        "src/index.ts",
        "src/value.ts",
      ]);
      expect(resolver.warnings).toEqual([]);
      expect(resolver.resolve("src/index.ts", "@parent")).toEqual({
        status: "unresolved",
        reason: "module_not_found",
      });
    } finally {
      fs.rmSync(parent, { recursive: true, force: true });
    }
  });

  it("fails safely when compiler configuration reads throw", () => {
    const workspace = writeWorkspace({
      "tsconfig.json": JSON.stringify({
        compilerOptions: { baseUrl: ".", paths: { "@/*": ["src/*"] } },
      }),
      "src/index.ts": "export {};\n",
    });
    vi.spyOn(ts.sys, "readFile").mockImplementation(() => {
      throw new Error("unreadable");
    });
    try {
      expect(() =>
        createResolver(workspace, ["src/index.ts"])
      ).not.toThrow();
      expect(createResolver(workspace, ["src/index.ts"]).warnings).toEqual([
        "Could not parse tsconfig/jsconfig; using default module resolution.",
      ]);
    } finally {
      fs.rmSync(workspace, { recursive: true, force: true });
    }
  });

  it("refuses relative and aliased files that escape through symlinks", () => {
    const parent = fs.mkdtempSync(
      path.join(os.tmpdir(), "repoatlas-ts-compiler-escape-")
    );
    const workspace = path.join(parent, "repository");
    fs.mkdirSync(path.join(workspace, "src"), { recursive: true });
    fs.writeFileSync(path.join(workspace, "src/index.ts"), "export {};\n");
    fs.writeFileSync(path.join(parent, "outside.ts"), "export const outside = true;\n");
    fs.symlinkSync(path.join(parent, "outside.ts"), path.join(workspace, "src/link.ts"));
    fs.writeFileSync(
      path.join(workspace, "tsconfig.json"),
      JSON.stringify({
        compilerOptions: {
          baseUrl: ".",
          paths: { "@outside": ["src/link.ts"] },
        },
      })
    );
    try {
      const resolver = createResolver(workspace, [
        "src/index.ts",
        "src/link.ts",
      ]);
      expect(resolver.resolve("src/index.ts", "./link")).toEqual({
        status: "unresolved",
        reason: "outside_workspace",
      });
      expect(resolver.resolve("src/index.ts", "@outside")).toEqual({
        status: "unresolved",
        reason: "outside_workspace",
      });
    } finally {
      fs.rmSync(parent, { recursive: true, force: true });
    }
  });

  it("keeps fallback order deterministic across indexed, ignored, and missing files", () => {
    const workspace = writeWorkspace({
      "src/index.ts": "export {};\n",
      "src/ignored.ts": "export const ignored = true;\n",
    });
    try {
      const resolver = createResolver(
        workspace,
        ["src/index.ts", "src/virtual.ts"],
        ["src/ignored.ts"]
      );
      expect(resolver.resolve("src/index.ts", "./virtual.ts")).toEqual({
        status: "resolved_internal",
        relPath: "src/virtual.ts",
      });
      expect(resolver.resolve("src/index.ts", "./ignored")).toEqual({
        status: "ignored",
        reason: "ignored_path",
      });
      expect(resolver.resolve("src/index.ts", "./missing")).toEqual({
        status: "unresolved",
        reason: "module_not_found",
      });
    } finally {
      fs.rmSync(workspace, { recursive: true, force: true });
    }
  });

  it("distinguishes unindexed repository files from external node modules", () => {
    const workspace = writeWorkspace({
      "package.json": JSON.stringify({ dependencies: { dependency: "1.0.0" } }),
      "src/index.ts": "export {};\n",
      "src/physical.ts": "export const physical = true;\n",
      "node_modules/dependency/package.json": JSON.stringify({
        name: "dependency",
        version: "1.0.0",
        types: "index.d.ts",
      }),
      "node_modules/dependency/index.d.ts": "export declare const value: boolean;\n",
    });
    try {
      const resolver = createResolver(workspace, ["src/index.ts"]);
      expect(resolver.resolve("src/index.ts", "./physical")).toEqual({
        status: "resolved_internal",
        relPath: "src/physical.ts",
      });
      expect(resolver.resolve("src/index.ts", "dependency")).toEqual({
        status: "resolved_external",
        packageName: "dependency",
      });
      expect(
        resolver.resolve("src/index.ts", "../node_modules/dependency")
      ).toEqual({
        status: "unresolved",
        reason: "outside_workspace",
      });
    } finally {
      fs.rmSync(workspace, { recursive: true, force: true });
    }
  });
});
