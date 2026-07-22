import fs from "fs";
import os from "os";
import path from "path";
import { describe, expect, it } from "vitest";
import { createTsJsResolver, discoverWorkspacePackages } from "./tsjsResolve";

function writeWorkspace(files: Record<string, string>): string {
  const workspace = fs.mkdtempSync(path.join(os.tmpdir(), "repoatlas-ts-resolve-"));
  for (const [relPath, content] of Object.entries(files)) {
    const fullPath = path.join(workspace, relPath);
    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
    fs.writeFileSync(fullPath, content, "utf-8");
  }
  return workspace;
}

function fileIndex(...files: string[]): Set<string> {
  return new Set(files.map((file) => path.normalize(file)));
}

describe("TypeScript resolution boundaries", () => {
  it("keeps every resolution module within the structural limit", () => {
    for (const fileName of [
      "tsjsResolve.ts",
      "tsjsResolveCompiler.ts",
      "tsjsResolvePackages.ts",
      "tsjsResolveShared.ts",
      "tsjsResolveWorkspaces.ts",
    ]) {
      const lineCount = fs
        .readFileSync(path.join(__dirname, fileName), "utf-8")
        .split(/\r?\n/).length;
      expect(lineCount, fileName).toBeLessThanOrEqual(350);
    }
  });

  it("classifies empty, ignored, missing, aliased, and external imports", () => {
    const workspace = writeWorkspace({
      "tsconfig.json": JSON.stringify({
        compilerOptions: { baseUrl: ".", paths: { "@/*": ["src/*"] } },
      }),
      "src/index.ts": "export {};\n",
      "src/alias.ts": "export const alias = true;\n",
      "src/ignored.ts": "export const ignored = true;\n",
    });
    try {
      const resolver = createTsJsResolver(
        workspace,
        fileIndex("src/index.ts", "src/alias.ts", "src/ignored.ts"),
        (relPath) => relPath.replace(/\\/g, "/") === "src/ignored.ts"
      );
      expect(resolver.resolve("src/index.ts", "")).toEqual({
        status: "unresolved",
        reason: "non_literal_specifier",
      });
      expect(resolver.resolve("src/index.ts", "@/alias")).toEqual({
        status: "resolved_internal",
        relPath: "src/alias.ts",
      });
      expect(resolver.resolve("src/index.ts", "./ignored")).toEqual({
        status: "ignored",
        reason: "ignored_path",
      });
      expect(resolver.resolve("src/index.ts", "./missing")).toEqual({
        status: "unresolved",
        reason: "module_not_found",
      });
      expect(resolver.resolve("src/index.ts", "react/jsx-runtime")).toEqual({
        status: "resolved_external",
        packageName: "react",
      });
      expect(resolver.resolve("src/index.ts", "@broken")).toEqual({
        status: "unresolved",
        reason: "module_not_found",
      });
    } finally {
      fs.rmSync(workspace, { recursive: true, force: true });
    }
  });

  it("keeps compiler configuration warnings deterministic", () => {
    const malformed = writeWorkspace({
      "tsconfig.json": "{not-json",
      "src/index.ts": "export {};\n",
    });
    const degraded = writeWorkspace({
      "tsconfig.json": JSON.stringify({ compilerOptions: { target: "not-a-target" } }),
      "src/index.ts": "export {};\n",
    });
    try {
      expect(
        createTsJsResolver(malformed, fileIndex("src/index.ts"), () => false).warnings
      ).toEqual(["Could not parse tsconfig/jsconfig; using default module resolution."]);
      expect(
        createTsJsResolver(degraded, fileIndex("src/index.ts"), () => false).warnings
      ).toEqual([
        "tsconfig/jsconfig reported parse issues; resolution may be degraded.",
      ]);
    } finally {
      fs.rmSync(malformed, { recursive: true, force: true });
      fs.rmSync(degraded, { recursive: true, force: true });
    }
  });

  it("discovers object workspaces and exact roots while rejecting nested globs", () => {
    const workspace = writeWorkspace({
      "package.json": JSON.stringify({
        name: "root",
        workspaces: { packages: ["libs/core", "packages/*", "ignored/**/deep"] },
      }),
      "libs/core/package.json": JSON.stringify({ name: "@acme/core" }),
      "packages/app/package.json": JSON.stringify({ name: "@acme/app" }),
      "packages/nameless/package.json": JSON.stringify({ private: true }),
    });
    try {
      expect(discoverWorkspacePackages(workspace)).toEqual([
        { name: "root", rootRel: ".", packageJsonRel: "package.json" },
        {
          name: "@acme/core",
          rootRel: "libs/core",
          packageJsonRel: "libs/core/package.json",
        },
        {
          name: "@acme/app",
          rootRel: "packages/app",
          packageJsonRel: "packages/app/package.json",
        },
      ]);
    } finally {
      fs.rmSync(workspace, { recursive: true, force: true });
    }
  });

  it("separates package exports, source recovery, and unsupported subpaths", () => {
    const workspace = writeWorkspace({
      "package.json": JSON.stringify({ name: "root", workspaces: ["packages/*"] }),
      "packages/conditions/package.json": JSON.stringify({
        name: "@acme/conditions",
        exports: { ".": { import: "./src/index.ts" } },
      }),
      "packages/conditions/src/index.ts": "export const value = true;\n",
      "packages/source/package.json": JSON.stringify({
        name: "@acme/source",
        exports: { ".": "./dist/index.js" },
      }),
      "packages/source/src/index.ts": "export const source = true;\n",
      "packages/main/package.json": JSON.stringify({
        name: "@acme/main",
        main: "src/main.ts",
      }),
      "packages/main/src/main.ts": "export const main = true;\n",
      "packages/main/src/feature/index.ts": "export const feature = true;\n",
      "packages/escaped/package.json": JSON.stringify({
        name: "@acme/escaped",
        exports: "../../outside.ts",
      }),
      "outside.ts": "export const outside = true;\n",
      "src/consumer.ts": "export {};\n",
    });
    const files = fileIndex(
      "packages/conditions/src/index.ts",
      "packages/source/src/index.ts",
      "packages/main/src/main.ts",
      "packages/main/src/feature/index.ts",
      "outside.ts",
      "src/consumer.ts"
    );
    try {
      const resolver = createTsJsResolver(workspace, files, () => false);
      expect(resolver.resolve("src/consumer.ts", "@acme/conditions")).toEqual({
        status: "resolved_internal",
        relPath: "packages/conditions/src/index.ts",
      });
      expect(resolver.resolve("src/consumer.ts", "@acme/source")).toEqual({
        status: "resolved_internal",
        relPath: "packages/source/src/index.ts",
      });
      expect(resolver.resolve("src/consumer.ts", "@acme/main")).toEqual({
        status: "resolved_internal",
        relPath: "packages/main/src/main.ts",
      });
      expect(resolver.resolve("src/consumer.ts", "@acme/main/feature")).toEqual({
        status: "resolved_internal",
        relPath: "packages/main/src/feature/index.ts",
      });
      expect(resolver.resolve("src/consumer.ts", "@acme/conditions/private")).toEqual({
        status: "unresolved",
        reason: "unsupported_package_exports",
      });
      expect(resolver.resolve("src/consumer.ts", "@acme/escaped")).toEqual({
        status: "unresolved",
        reason: "module_not_found",
      });
    } finally {
      fs.rmSync(workspace, { recursive: true, force: true });
    }
  });
});
