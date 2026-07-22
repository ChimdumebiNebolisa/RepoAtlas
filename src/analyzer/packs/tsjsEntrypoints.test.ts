import fs from "fs";
import os from "os";
import path from "path";
import { afterEach, describe, expect, it } from "vitest";
import { detectTsJsEntrypoints } from "./tsjsEntrypoints";

const workspaces: string[] = [];

function createWorkspace(manifests: Record<string, unknown | string>): string {
  const workspace = fs.mkdtempSync(path.join(os.tmpdir(), "repoatlas-tsjs-entrypoints-"));
  workspaces.push(workspace);
  for (const [relPath, value] of Object.entries(manifests)) {
    const abs = path.join(workspace, relPath);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, typeof value === "string" ? value : JSON.stringify(value), "utf-8");
  }
  return workspace;
}

afterEach(() => {
  for (const workspace of workspaces.splice(0)) {
    fs.rmSync(workspace, { recursive: true, force: true });
  }
});

describe("detectTsJsEntrypoints", () => {
  it("combines common, manifest, export, bin, and runnable script targets", () => {
    const workspace = createWorkspace({
      "package.json": {
        main: "./src/main.ts",
        module: "./src/module.mjs",
        browser: "./src/browser.js",
        types: "./src/public-types.ts",
        bin: "./src/cli.cjs",
        exports: {
          ".": {
            import: "./src/exported.ts",
            require: ["./src/exported.cjs", "external-package"],
            browser: "./src/not-an-export.ts",
          },
          "./feature": { default: "./src/feature.ts" },
        },
        scripts: {
          dev: "tsx ./src/dev.ts --watch",
          start: "node 'src/start.js'",
          build: "node ./src/build.mjs && node ./src/missing.ts",
          lint: "eslint src/lint.ts",
          ignored: 42,
        },
      },
    });
    const files = [
      "src/index.ts",
      "src/main.ts",
      "src/module.mjs",
      "src/browser.js",
      "src/public-types.ts",
      "src/cli.cjs",
      "src/exported.ts",
      "src/exported.cjs",
      "src/not-an-export.ts",
      "src/feature.ts",
      "src/dev.ts",
      "src/start.js",
      "src/build.mjs",
      "src/lint.ts",
    ];

    const result = detectTsJsEntrypoints(files, workspace, ["package.json"]);

    expect([...result.entrypoints]).toEqual([
      ["src/index.ts", "common entry file src/index.ts"],
      ["src/main.ts", "package.json main"],
      ["src/cli.cjs", "package.json bin"],
      ["src/module.mjs", "package.json module"],
      ["src/browser.js", "package.json browser"],
      ["src/public-types.ts", "package.json types"],
      ["src/exported.ts", "package.json exports"],
      ["src/exported.cjs", "package.json exports"],
      ["src/feature.ts", "package.json exports"],
      ["src/dev.ts", "package.json scripts.dev"],
      ["src/start.js", "package.json scripts.start"],
      ["src/build.mjs", "package.json scripts.build"],
    ]);
    expect(result.entrypoints.has("src/not-an-export.ts")).toBe(false);
    expect(result.entrypoints.has("src/lint.ts")).toBe(false);
    expect(result.warnings).toEqual([]);
  });

  it("resolves nested manifests and ignores invalid values and missing targets", () => {
    const workspace = createWorkspace({
      "packages/tool/package.json": {
        main: "src/index.ts",
        module: 12,
        browser: false,
        bin: {
          tool: "src/cli.ts",
          invalid: 7,
        },
        exports: [
          null,
          false,
          "external-package",
          { import: "./src/index.ts", custom: "./src/custom.ts" },
          { "./worker": { module: "./src/worker.ts" } },
        ],
        scripts: {
          dev: false,
          start: "node ./src/does-not-exist.ts",
          build: "tsc",
        },
      },
    });

    const result = detectTsJsEntrypoints(
      [
        "packages/tool/src/index.ts",
        "packages/tool/src/cli.ts",
        "packages/tool/src/custom.ts",
        "packages/tool/src/worker.ts",
      ],
      workspace,
      ["packages/tool/package.json"]
    );

    expect([...result.entrypoints]).toEqual([
      ["packages/tool/src/index.ts", "package.json exports"],
      ["packages/tool/src/cli.ts", "package.json bin:tool"],
      ["packages/tool/src/worker.ts", "package.json exports"],
    ]);
    expect(result.entrypoints.has("packages/tool/src/custom.ts")).toBe(false);
    expect(result.warnings).toEqual([]);
  });

  it("detects supported Next.js file conventions but excludes shells and tests", () => {
    const files = [
      "app/page.tsx",
      "src/app/admin/layout.jsx",
      "app/route.ts",
      "src/app/webhooks/github/route.js",
      "middleware.mjs",
      "src/middleware.ts",
      "pages/index.tsx",
      "src/pages/api/health.ts",
      "pages/_app.tsx",
      "pages/_document.tsx",
      "pages/_error.tsx",
      "pages/account.test.tsx",
      "src/pages/__tests__/api.spec.ts",
      "src/index.test.ts",
    ];

    const result = detectTsJsEntrypoints(files, "/unused", []);

    expect([...result.entrypoints]).toEqual([
      ["app/page.tsx", "Next.js App Router page"],
      ["src/app/admin/layout.jsx", "Next.js App Router layout"],
      ["app/route.ts", "Next.js App Router route handler"],
      ["src/app/webhooks/github/route.js", "Next.js App Router route handler"],
      ["middleware.mjs", "Next.js middleware"],
      ["src/middleware.ts", "Next.js middleware"],
      ["pages/index.tsx", "Next.js Pages Router page"],
      ["src/pages/api/health.ts", "Next.js Pages Router page"],
    ]);
  });

  it("warns once per unreadable or non-object package manifest", () => {
    const workspace = createWorkspace({
      "invalid.json": "{not-json",
      "null.json": "null",
      "string.json": JSON.stringify("not-an-object"),
    });

    const result = detectTsJsEntrypoints([], workspace, [
      "invalid.json",
      "null.json",
      "string.json",
      "missing.json",
    ]);

    expect(result.entrypoints.size).toBe(0);
    expect(result.warnings).toEqual([
      "Could not parse invalid.json for entrypoints",
      "Could not parse null.json for entrypoints",
      "Could not parse string.json for entrypoints",
      "Could not parse missing.json for entrypoints",
    ]);
  });

  it("does not classify test files even when package metadata names them", () => {
    const workspace = createWorkspace({
      "package.json": {
        main: "./src/index.test.ts",
        bin: { test: "./src/__tests__/cli.ts" },
        exports: "./src/public.spec.ts",
        scripts: { start: "node ./src/start.test.ts" },
      },
    });
    const files = [
      "src/index.test.ts",
      "src/__tests__/cli.ts",
      "src/public.spec.ts",
      "src/start.test.ts",
    ];

    const result = detectTsJsEntrypoints(files, workspace, ["package.json"]);

    expect(result.entrypoints.size).toBe(0);
  });
});
