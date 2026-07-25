import fs from "fs";
import os from "os";
import path from "path";
import { afterEach, describe, expect, it } from "vitest";
import { createWorkspacePackageResolver } from "./tsjsResolvePackages";
import type { WorkspacePackage } from "./tsjsResolveShared";

const workspaces: string[] = [];

function writeWorkspace(files: Record<string, string>): string {
  const workspace = fs.mkdtempSync(
    path.join(os.tmpdir(), "repoatlas-ts-packages-")
  );
  workspaces.push(workspace);
  for (const [relPath, content] of Object.entries(files)) {
    const fullPath = path.join(workspace, relPath);
    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
    fs.writeFileSync(fullPath, content, "utf-8");
  }
  return workspace;
}

function packageRecord(name: string, rootRel: string): WorkspacePackage {
  return {
    name,
    rootRel,
    packageJsonRel:
      rootRel === "." ? "package.json" : `${rootRel}/package.json`,
  };
}

function createResolver(
  workspacePath: string,
  packages: WorkspacePackage[],
  options: {
    ignored?: string[];
    indexed?: Record<string, string>;
  } = {}
) {
  const ignored = new Set(options.ignored ?? []);
  const indexed = new Map(Object.entries(options.indexed ?? {}));
  return createWorkspacePackageResolver({
    workspacePath,
    packages,
    isIgnored: (relPath) => ignored.has(relPath),
    findIndexedFile: (relPath) => indexed.get(relPath) ?? null,
  });
}

describe("workspace package export resolution", () => {
  afterEach(() => {
    for (const workspace of workspaces.splice(0)) {
      fs.rmSync(workspace, { recursive: true, force: true });
    }
  });

  it("resolves root string and conditional exports in condition order", () => {
    const workspace = writeWorkspace({
      "packages/string/package.json": JSON.stringify({
        name: "@acme/string",
        exports: "./src/root.ts",
      }),
      "packages/string/src/root.ts": "export const root = true;\n",
      "packages/conditional/package.json": JSON.stringify({
        name: "@acme/conditional",
        exports: {
          import: "./dist/missing.mjs",
          default: "./src/default.ts",
        },
      }),
      "packages/conditional/src/default.ts": "export const value = true;\n",
    });
    const resolver = createResolver(workspace, [
      packageRecord("@acme/string", "packages/string"),
      packageRecord("@acme/conditional", "packages/conditional"),
    ]);

    expect(resolver("@acme/string")).toEqual({
      status: "resolved_internal",
      relPath: "packages/string/src/root.ts",
    });
    expect(resolver("@acme/conditional")).toEqual({
      status: "resolved_internal",
      relPath: "packages/conditional/src/default.ts",
    });
  });

  it("honors exported subpaths and keeps blocked subpaths blocked", () => {
    const workspace = writeWorkspace({
      "packages/maps/package.json": JSON.stringify({
        name: "@acme/maps",
        exports: {
          ".": { require: "./src/root.cjs" },
          "./feature": { browser: "./src/feature.js" },
          "./private": null,
          "./unsupported": ["./src/unsupported.ts"],
        },
      }),
      "packages/maps/src/root.cjs": "module.exports = {};\n",
      "packages/maps/src/feature.js": "export const feature = true;\n",
      "packages/maps/src/private.ts": "export const privateValue = true;\n",
      "packages/maps/src/unsupported.ts": "export const value = true;\n",
    });
    const resolver = createResolver(workspace, [
      packageRecord("@acme/maps", "packages/maps"),
    ]);

    expect(resolver("@acme/maps")).toEqual({
      status: "resolved_internal",
      relPath: "packages/maps/src/root.cjs",
    });
    expect(resolver("@acme/maps/feature")).toEqual({
      status: "resolved_internal",
      relPath: "packages/maps/src/feature.js",
    });
    expect(resolver("@acme/maps/private")).toEqual({
      status: "unresolved",
      reason: "unsupported_package_exports",
    });
    expect(resolver("@acme/maps/unsupported")).toEqual({
      status: "unresolved",
      reason: "unsupported_package_exports",
    });
    expect(resolver("@acme/maps/missing")).toEqual({
      status: "unresolved",
      reason: "unsupported_package_exports",
    });
  });

  it("does not bypass root-only or unsupported export maps", () => {
    const workspace = writeWorkspace({
      "packages/root-only/package.json": JSON.stringify({
        name: "@acme/root-only",
        exports: "./src/index.ts",
      }),
      "packages/root-only/src/index.ts": "export const root = true;\n",
      "packages/root-only/src/private.ts": "export const privateValue = true;\n",
      "packages/unknown/package.json": JSON.stringify({
        name: "@acme/unknown",
        exports: { node: "./src/index.ts" },
      }),
      "packages/unknown/src/index.ts": "export const value = true;\n",
      "packages/array/package.json": JSON.stringify({
        name: "@acme/array",
        exports: ["./src/index.ts"],
      }),
      "packages/array/src/index.ts": "export const value = true;\n",
    });
    const resolver = createResolver(workspace, [
      packageRecord("@acme/root-only", "packages/root-only"),
      packageRecord("@acme/unknown", "packages/unknown"),
      packageRecord("@acme/array", "packages/array"),
    ]);

    for (const specifier of [
      "@acme/root-only/private",
      "@acme/unknown",
      "@acme/array",
    ]) {
      expect(resolver(specifier), specifier).toEqual({
        status: "unresolved",
        reason: "unsupported_package_exports",
      });
    }
  });

  it("recovers omitted build targets from exact, extension, and index source files", () => {
    const workspace = writeWorkspace({
      "packages/recovery/package.json": JSON.stringify({
        name: "@acme/recovery",
        exports: {
          ".": "./dist/index.js",
          "./exact": "./dist/exact.js",
          "./feature": { import: "./dist/feature.js" },
        },
      }),
      "packages/recovery/src/index.ts": "export const root = true;\n",
      "packages/recovery/src/exact": "export const exact = true;\n",
      "packages/recovery/src/feature/index.tsx": "export const feature = true;\n",
    });
    const resolver = createResolver(workspace, [
      packageRecord("@acme/recovery", "packages/recovery"),
    ]);

    expect(resolver("@acme/recovery")).toEqual({
      status: "resolved_internal",
      relPath: "packages/recovery/src/index.ts",
    });
    expect(resolver("@acme/recovery/exact")).toEqual({
      status: "resolved_internal",
      relPath: "packages/recovery/src/exact",
    });
    expect(resolver("@acme/recovery/feature")).toEqual({
      status: "resolved_internal",
      relPath: "packages/recovery/src/feature/index.tsx",
    });
  });

  it("uses direct subpath, extension, index, manifest, and package-index fallbacks", () => {
    const workspace = writeWorkspace({
      "packages/plain/package.json": JSON.stringify({
        name: "@acme/plain",
        module: "./missing.mjs",
        main: "./entry",
      }),
      "packages/plain/entry.js": "export const entry = true;\n",
      "packages/plain/direct": "export const direct = true;\n",
      "packages/plain/extension.tsx": "export const extension = true;\n",
      "packages/plain/nested/index.mjs": "export const nested = true;\n",
      "packages/index/package.json": JSON.stringify({ name: "@acme/index" }),
      "packages/index/index.jsx": "export const index = true;\n",
    });
    const resolver = createResolver(workspace, [
      packageRecord("@acme/plain", "packages/plain"),
      packageRecord("@acme/index", "packages/index"),
    ]);

    expect(resolver("@acme/plain")).toEqual({
      status: "resolved_internal",
      relPath: "packages/plain/entry.js",
    });
    expect(resolver("@acme/plain/direct")).toEqual({
      status: "resolved_internal",
      relPath: "packages/plain/direct",
    });
    expect(resolver("@acme/plain/extension")).toEqual({
      status: "resolved_internal",
      relPath: "packages/plain/extension.tsx",
    });
    expect(resolver("@acme/plain/nested")).toEqual({
      status: "resolved_internal",
      relPath: "packages/plain/nested/index.mjs",
    });
    expect(resolver("@acme/index")).toEqual({
      status: "resolved_internal",
      relPath: "packages/index/index.jsx",
    });
  });

  it("contains workspace paths and distinguishes ignored, indexed, and missing results", () => {
    const workspace = writeWorkspace({
      "package.json": JSON.stringify({ name: "@acme/root", main: "src/root.ts" }),
      "src/root.ts": "export const root = true;\n",
      "packages/ignored/package.json": JSON.stringify({
        name: "@acme/ignored",
        main: "src/index.ts",
      }),
      "packages/ignored/src/index.ts": "export const ignored = true;\n",
      "packages/malformed/package.json": "{not-json",
      "outside/package.json": JSON.stringify({
        name: "@acme/outside",
        main: "index.ts",
      }),
      "outside/index.ts": "export const outside = true;\n",
    });
    const outsideRoot = fs.mkdtempSync(
      path.join(path.dirname(workspace), "repoatlas-ts-packages-outside-")
    );
    workspaces.push(outsideRoot);
    fs.writeFileSync(
      path.join(outsideRoot, "package.json"),
      JSON.stringify({ name: "@acme/escaped", main: "index.ts" }),
      "utf-8"
    );
    fs.writeFileSync(
      path.join(outsideRoot, "index.ts"),
      "export const escaped = true;\n",
      "utf-8"
    );
    const escapedRoot = path.relative(workspace, outsideRoot);
    const resolver = createResolver(
      workspace,
      [
        packageRecord("@acme/root", "."),
        packageRecord("@acme/ignored", "packages/ignored"),
        packageRecord("@acme/malformed", "packages/malformed"),
        packageRecord("@acme/escaped", escapedRoot),
      ],
      {
        ignored: ["packages/ignored/src/index.ts"],
        indexed: { "src/root.ts": "SRC/ROOT.ts" },
      }
    );

    expect(resolver("invalid specifier")).toBeNull();
    expect(resolver("external")).toBeNull();
    expect(resolver("@acme/root")).toEqual({
      status: "resolved_internal",
      relPath: "SRC/ROOT.ts",
    });
    expect(resolver("@acme/ignored")).toEqual({
      status: "ignored",
      reason: "ignored_path",
    });
    expect(resolver("@acme/malformed")).toEqual({
      status: "unresolved",
      reason: "module_not_found",
    });
    expect(resolver("@acme/escaped")).toEqual({
      status: "unresolved",
      reason: "outside_workspace",
    });
  });
});
