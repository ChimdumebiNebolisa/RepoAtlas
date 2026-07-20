/**
 * Semantic graph / TypeScript AST resolution fixture matrix.
 */

import fs from "fs";
import os from "os";
import path from "path";
import { describe, expect, it } from "vitest";
import { runTsJsPack } from "./tsjs";
import type { IndexingPipelineResult } from "../pipeline";
import { finalizeSemanticGraph } from "../semanticGraph";

const relKey = (...segments: string[]) => path.join(...segments);
const normalizeKey = (value: string) => value.replace(/\\/g, "/");

function writeWorkspace(files: Record<string, string>): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "repoatlas-tsjs-sem-"));
  for (const [relPath, content] of Object.entries(files)) {
    const fullPath = path.join(dir, relPath);
    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
    fs.writeFileSync(fullPath, content, "utf-8");
  }
  return dir;
}

function buildPipeline(filePaths: string[]): IndexingPipelineResult {
  const file_metadata = new Map<
    string,
    { path: string; size: number; extension: string; language: string }
  >();

  for (const filePath of filePaths) {
    const ext = path.extname(filePath);
    file_metadata.set(filePath, {
      path: filePath,
      size: 100,
      extension: ext,
      language: ext === ".ts" || ext === ".tsx" ? "typescript" : "javascript",
    });
  }

  return {
    folder_map: { path: ".", type: "dir", children: [] },
    run_commands: [],
    contribute_signals: { key_docs: [], ci_configs: [] },
    file_metadata,
    key_docs: [],
    ci_configs: [],
    warnings: [],
  };
}

function stableGraphJson(result: ReturnType<typeof runTsJsPack>): string {
  const graph = result.semanticGraph;
  expect(graph).toBeTruthy();
  // Drop non-deterministic fields if any; finalize already sorts.
  return JSON.stringify(
    finalizeSemanticGraph({
      language: graph!.language,
      adapter: graph!.adapter,
      nodes: graph!.nodes,
      edges: graph!.edges,
      warnings: graph!.warnings,
    })
  );
}

describe("TS/JS semantic graph fixture matrix", () => {
  it("ignores fake imports in comments and strings", () => {
    const workspace = writeWorkspace({
      "src/index.ts": [
        '// import { fake } from "./fake";',
        'const s = \'import { x } from "./also-fake"\';',
        "export const ok = 1;",
      ].join("\n"),
      "src/fake.ts": "export const fake = 1;\n",
    });
    const indexFile = relKey("src", "index.ts");
    const fakeFile = relKey("src", "fake.ts");
    const pipeline = buildPipeline([indexFile, fakeFile]);
    try {
      const result = runTsJsPack(workspace, pipeline);
      expect(result.imports.get(indexFile)?.size ?? 0).toBe(0);
      expect(
        result.semanticGraph?.edges.filter((e) => e.resolution === "resolved_internal")
      ).toHaveLength(0);
    } finally {
      fs.rmSync(workspace, { recursive: true, force: true });
    }
  });

  it("resolves tsconfig paths aliases and baseUrl", () => {
    const workspace = writeWorkspace({
      "tsconfig.json": JSON.stringify({
        compilerOptions: {
          baseUrl: ".",
          paths: { "@lib/*": ["src/lib/*"] },
        },
      }),
      "src/index.ts": 'import { util } from "@lib/util";\nvoid util;\n',
      "src/lib/util.ts": "export const util = 1;\n",
    });
    const indexFile = relKey("src", "index.ts");
    const utilFile = relKey("src", "lib", "util.ts");
    try {
      const result = runTsJsPack(workspace, buildPipeline([indexFile, utilFile]));
      expect(result.imports.get(indexFile)).toEqual(new Set([utilFile]));
      const edge = result.semanticGraph?.edges.find(
        (e) => e.specifier === "@lib/util" && e.resolution === "resolved_internal"
      );
      expect(edge?.to).toBe(`file:${normalizeKey(utilFile)}`);
      expect(edge?.evidence.line_start).toBe(1);
    } finally {
      fs.rmSync(workspace, { recursive: true, force: true });
    }
  });

  it("records dynamic import, require, type-only, and re-export edges", () => {
    const workspace = writeWorkspace({
      "src/index.ts": [
        'import type { T } from "./types";',
        'export { helper } from "./helper";',
        'const a = require("./cjs");',
        'const dyn = import("./dyn");',
        "void a; void dyn; type _ = T;",
      ].join("\n"),
      "src/types.ts": "export type T = string;\n",
      "src/helper.ts": "export const helper = 1;\n",
      "src/cjs.ts": "export const cjs = 1;\n",
      "src/dyn.ts": "export const dyn = 1;\n",
    });
    const files = ["index", "types", "helper", "cjs", "dyn"].map((n) =>
      relKey("src", `${n}.ts`)
    );
    try {
      const result = runTsJsPack(workspace, buildPipeline(files));
      const kinds = new Set(
        result.semanticGraph?.edges
          .filter((e) => e.resolution === "resolved_internal")
          .map((e) => e.kind)
      );
      expect(kinds.has("import")).toBe(true);
      expect(kinds.has("re_export")).toBe(true);
      expect(kinds.has("require")).toBe(true);
      expect(kinds.has("dynamic_import")).toBe(true);
      expect(
        result.semanticGraph?.edges.some((e) => e.type_only && e.specifier === "./types")
      ).toBe(true);
      expect(result.fanOut.get(files[0])).toBe(4);
    } finally {
      fs.rmSync(workspace, { recursive: true, force: true });
    }
  });

  it("records nonliteral dynamic import as unresolved without inflating fan-out", () => {
    const workspace = writeWorkspace({
      "src/index.ts":
        'const name = "./x";\nconst dyn = import(name);\nimport { y } from "./y";\nvoid dyn; void y;\n',
      "src/y.ts": "export const y = 1;\n",
      "src/x.ts": "export const x = 1;\n",
    });
    const indexFile = relKey("src", "index.ts");
    const yFile = relKey("src", "y.ts");
    const xFile = relKey("src", "x.ts");
    try {
      const result = runTsJsPack(
        workspace,
        buildPipeline([indexFile, yFile, xFile])
      );
      expect(result.imports.get(indexFile)).toEqual(new Set([yFile]));
      expect(result.fanOut.get(indexFile)).toBe(1);
      expect(
        result.semanticGraph?.edges.some(
          (e) => e.reason === "non_literal_specifier" && e.resolution === "unresolved"
        )
      ).toBe(true);
    } finally {
      fs.rmSync(workspace, { recursive: true, force: true });
    }
  });

  it("resolves npm workspace package names to package files", () => {
    const workspace = writeWorkspace({
      "package.json": JSON.stringify({
        name: "root",
        private: true,
        workspaces: ["packages/*"],
      }),
      "packages/a/package.json": JSON.stringify({
        name: "@acme/a",
        main: "src/index.ts",
      }),
      "packages/a/src/index.ts": "export const a = 1;\n",
      "packages/b/package.json": JSON.stringify({ name: "@acme/b" }),
      "packages/b/src/index.ts": 'import { a } from "@acme/a";\nvoid a;\n',
    });
    const aIndex = relKey("packages", "a", "src", "index.ts");
    const bIndex = relKey("packages", "b", "src", "index.ts");
    try {
      const result = runTsJsPack(workspace, buildPipeline([aIndex, bIndex]));
      expect(result.imports.get(bIndex)).toEqual(new Set([aIndex]));
      expect(
        result.semanticGraph?.nodes.some((n) => n.id === "package:@acme/a")
      ).toBe(true);
    } finally {
      fs.rmSync(workspace, { recursive: true, force: true });
    }
  });

  it("resolves pnpm workspace packages", () => {
    const workspace = writeWorkspace({
      "pnpm-workspace.yaml": "packages:\n  - 'packages/*'\n",
      "package.json": JSON.stringify({ name: "root", private: true }),
      "packages/core/package.json": JSON.stringify({
        name: "@scope/core",
        exports: { ".": "./src/index.ts" },
      }),
      "packages/core/src/index.ts": "export const core = 1;\n",
      "packages/app/package.json": JSON.stringify({ name: "@scope/app" }),
      "packages/app/src/main.ts": 'import { core } from "@scope/core";\nvoid core;\n',
    });
    const core = relKey("packages", "core", "src", "index.ts");
    const app = relKey("packages", "app", "src", "main.ts");
    try {
      const result = runTsJsPack(workspace, buildPipeline([core, app]));
      expect(result.imports.get(app)).toEqual(new Set([core]));
    } finally {
      fs.rmSync(workspace, { recursive: true, force: true });
    }
  });

  it("resolves workspace source when exports point to omitted build output", () => {
    const workspace = writeWorkspace({
      "package.json": JSON.stringify({
        name: "root",
        private: true,
        workspaces: ["packages/*"],
      }),
      "packages/core/package.json": JSON.stringify({
        name: "@scope/core",
        exports: { ".": "./dist/index.mjs" },
      }),
      "packages/core/src/index.ts": "export const core = 1;\n",
      "packages/core/src/private.ts": "export const hidden = 1;\n",
      "packages/app/package.json": JSON.stringify({ name: "@scope/app" }),
      "packages/app/src/main.ts":
        'import { core } from "@scope/core";\nimport { hidden } from "@scope/core/private";\nvoid core;\nvoid hidden;\n',
    });
    const core = relKey("packages", "core", "src", "index.ts");
    const app = relKey("packages", "app", "src", "main.ts");
    try {
      const result = runTsJsPack(workspace, buildPipeline([core, app]));
      expect(result.imports.get(app)).toEqual(new Set([core]));
      expect(
        result.semanticGraph?.edges.find((edge) => edge.specifier === "@scope/core")
      ).toMatchObject({
        resolution: "resolved_internal",
        to: `file:${normalizeKey(core)}`,
      });
      expect(
        result.semanticGraph?.edges.find(
          (edge) => edge.specifier === "@scope/core/private"
        )
      ).toMatchObject({
        resolution: "unresolved",
        reason: "unsupported_package_exports",
      });
    } finally {
      fs.rmSync(workspace, { recursive: true, force: true });
    }
  });

  it("records external and unresolved modules without inflating fan-in", () => {
    const workspace = writeWorkspace({
      "src/index.ts":
        'import React from "react";\nimport { missing } from "./nope";\nimport { local } from "./local";\nvoid React; void missing; void local;\n',
      "src/local.ts": "export const local = 1;\n",
    });
    const indexFile = relKey("src", "index.ts");
    const localFile = relKey("src", "local.ts");
    try {
      const result = runTsJsPack(workspace, buildPipeline([indexFile, localFile]));
      expect(result.imports.get(indexFile)).toEqual(new Set([localFile]));
      expect(result.fanIn.get(localFile)).toBe(1);
      expect(
        result.semanticGraph?.edges.some(
          (e) => e.specifier === "react" && e.resolution === "resolved_external"
        )
      ).toBe(true);
      expect(
        result.semanticGraph?.edges.some(
          (e) => e.specifier === "./nope" && e.resolution === "unresolved"
        )
      ).toBe(true);
    } finally {
      fs.rmSync(workspace, { recursive: true, force: true });
    }
  });

  it("handles TSX/JSX and does not invent edges from JSX text", () => {
    const workspace = writeWorkspace({
      "src/App.tsx":
        'import { Button } from "./Button";\nexport function App() { return <Button>import "./fake"</Button>; }\n',
      "src/Button.tsx": "export function Button(props: { children?: unknown }) { return null; }\n",
      "src/fake.ts": "export const fake = 1;\n",
    });
    const app = relKey("src", "App.tsx");
    const button = relKey("src", "Button.tsx");
    const fake = relKey("src", "fake.ts");
    try {
      const result = runTsJsPack(workspace, buildPipeline([app, button, fake]));
      expect(result.imports.get(app)).toEqual(new Set([button]));
    } finally {
      fs.rmSync(workspace, { recursive: true, force: true });
    }
  });

  it("deduplicates relative and package aliases to one file node", () => {
    const workspace = writeWorkspace({
      "package.json": JSON.stringify({
        name: "root",
        private: true,
        workspaces: ["packages/*"],
      }),
      "packages/ui/package.json": JSON.stringify({
        name: "@acme/ui",
        main: "src/button.ts",
      }),
      "packages/ui/src/button.ts": "export const button = 1;\n",
      "packages/app/src/a.ts": 'import { button } from "@acme/ui";\nvoid button;\n',
      "packages/app/src/b.ts":
        'import { button } from "../../ui/src/button";\nvoid button;\n',
    });
    const button = relKey("packages", "ui", "src", "button.ts");
    const a = relKey("packages", "app", "src", "a.ts");
    const b = relKey("packages", "app", "src", "b.ts");
    try {
      const result = runTsJsPack(workspace, buildPipeline([button, a, b]));
      const fileNodes = result.semanticGraph?.nodes.filter(
        (n) => n.label === normalizeKey(button)
      );
      expect(fileNodes).toHaveLength(1);
      expect(result.fanIn.get(button)).toBe(2);
    } finally {
      fs.rmSync(workspace, { recursive: true, force: true });
    }
  });

  it("detects package bin and nested Next.js route entrypoints with reasons", () => {
    const workspace = writeWorkspace({
      "package.json": JSON.stringify({
        name: "cli-app",
        bin: { tool: "./src/cli.ts" },
        scripts: { start: "node ./src/server.ts" },
      }),
      "src/cli.ts": "export const cli = true;\n",
      "src/server.ts": "export const server = true;\n",
      "src/app/dashboard/page.tsx": "export default function Page() { return null; }\n",
      "src/middleware.ts": "export function middleware() {}\n",
      "src/util.ts": "export const util = 1;\n",
    });
    const cli = relKey("src", "cli.ts");
    const server = relKey("src", "server.ts");
    const page = relKey("src", "app", "dashboard", "page.tsx");
    const middleware = relKey("src", "middleware.ts");
    const util = relKey("src", "util.ts");
    try {
      const result = runTsJsPack(
        workspace,
        buildPipeline([cli, server, page, middleware, util])
      );
      expect(result.entrypoints.has(cli)).toBe(true);
      expect(result.entrypoints.has(server)).toBe(true);
      expect(result.entrypoints.has(page)).toBe(true);
      expect(result.entrypoints.has(middleware)).toBe(true);
      expect(result.entrypoints.has(util)).toBe(false);
      expect(result.entrypointReasons?.get(cli)).toMatch(/bin/);
      expect(result.entrypointReasons?.get(page)).toMatch(/page/);
    } finally {
      fs.rmSync(workspace, { recursive: true, force: true });
    }
  });

  it("computes AST structural complexity higher for nested branches", () => {
    const workspace = writeWorkspace({
      "src/simple.ts": "export function a() {\n  return 1;\n}\n",
      "src/complex.ts":
        "export function b(v: number) {\n  if (v > 0) {\n    for (let i = 0; i < v; i++) {\n      if (i % 2 === 0 || i === 1) {\n        while (false) {\n          // noop\n        }\n      }\n    }\n  }\n  return v ? 1 : 0;\n}\n",
    });
    const simple = relKey("src", "simple.ts");
    const complex = relKey("src", "complex.ts");
    try {
      const result = runTsJsPack(workspace, buildPipeline([simple, complex]));
      expect((result.complexity.get(complex) ?? 0)).toBeGreaterThan(
        result.complexity.get(simple) ?? 0
      );
    } finally {
      fs.rmSync(workspace, { recursive: true, force: true });
    }
  });

  it("produces byte-stable semantic graph JSON across two runs", () => {
    const workspace = writeWorkspace({
      "src/index.ts": 'import { x } from "./x";\nexport { x };\n',
      "src/x.ts": "export const x = 1;\n",
    });
    const files = [relKey("src", "index.ts"), relKey("src", "x.ts")];
    const pipeline = buildPipeline(files);
    try {
      const first = stableGraphJson(runTsJsPack(workspace, pipeline));
      const second = stableGraphJson(runTsJsPack(workspace, pipeline));
      expect(first).toBe(second);
    } finally {
      fs.rmSync(workspace, { recursive: true, force: true });
    }
  });
});
