import fs from "fs";
import os from "os";
import path from "path";
import { describe, expect, it } from "vitest";
import { runTsJsPack } from "./tsjs";
import type { IndexingPipelineResult } from "../pipeline";

const relKey = (...segments: string[]) => path.join(...segments);
const normalizeKey = (value: string) => value.replace(/\\/g, "/");

function writeWorkspace(files: Record<string, string>): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "repoatlas-tsjs-pack-"));
  for (const [relPath, content] of Object.entries(files)) {
    const fullPath = path.join(dir, relPath);
    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
    fs.writeFileSync(fullPath, content, "utf-8");
  }
  return dir;
}

function buildPipeline(filePaths: string[]): IndexingPipelineResult {
  const file_metadata = new Map<string, { path: string; size: number; extension: string; language: string }>();

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

describe("runTsJsPack import resolution", () => {
  it("resolves extensionless relative imports to files", () => {
    const workspace = writeWorkspace({
      "src/index.ts": 'import { util } from "./util";\nvoid util;\n',
      "src/util.ts": "export const util = 1;\n",
    });
    const indexFile = relKey("src", "index.ts");
    const utilFile = relKey("src", "util.ts");
    const pipeline = buildPipeline([indexFile, utilFile]);

    try {
      const result = runTsJsPack(workspace, pipeline);
      expect(result.imports.get(indexFile)).toEqual(new Set([utilFile]));
    } finally {
      fs.rmSync(workspace, { recursive: true, force: true });
    }
  });

  it("resolves directory imports to index files", () => {
    const workspace = writeWorkspace({
      "src/index.ts": 'import { x } from "./lib";\nvoid x;\n',
      "src/lib/index.ts": "export const x = 1;\n",
    });
    const indexFile = relKey("src", "index.ts");
    const libIndexFile = relKey("src", "lib", "index.ts");
    const pipeline = buildPipeline([indexFile, libIndexFile]);

    try {
      const result = runTsJsPack(workspace, pipeline);
      expect(result.imports.get(indexFile)).toEqual(new Set([libIndexFile]));
    } finally {
      fs.rmSync(workspace, { recursive: true, force: true });
    }
  });

  it("extracts require() and import() edges", () => {
    const workspace = writeWorkspace({
      "src/index.ts":
        'const a = require("./a");\nasync function load() { return import("./b"); }\nvoid a; void load;\n',
      "src/a.ts": "export const a = 1;\n",
      "src/b.ts": "export const b = 2;\n",
    });
    const indexFile = relKey("src", "index.ts");
    const aFile = relKey("src", "a.ts");
    const bFile = relKey("src", "b.ts");
    const pipeline = buildPipeline([indexFile, aFile, bFile]);

    try {
      const result = runTsJsPack(workspace, pipeline);
      expect(result.imports.get(indexFile)).toEqual(new Set([aFile, bFile]));
    } finally {
      fs.rmSync(workspace, { recursive: true, force: true });
    }
  });

  it("ignores non-relative imports and ignored directories", () => {
    const workspace = writeWorkspace({
      "src/index.ts": 'import React from "react";\nimport { x } from "./util";\nvoid React; void x;\n',
      "src/util.ts": "export const x = 1;\n",
      "dist/gen.ts": "export const generated = true;\n",
      "src/consumer.ts": 'import "../dist/gen";\n',
    });
    const indexFile = relKey("src", "index.ts");
    const utilFile = relKey("src", "util.ts");
    const distFile = relKey("dist", "gen.ts");
    const consumerFile = relKey("src", "consumer.ts");
    const pipeline = buildPipeline([indexFile, utilFile, distFile, consumerFile]);

    try {
      const result = runTsJsPack(workspace, pipeline);
      expect(result.imports.get(indexFile)).toEqual(new Set([utilFile]));
      expect(result.imports.get(consumerFile)).toEqual(new Set());
      expect(result.imports.has(distFile)).toBe(false);
    } finally {
      fs.rmSync(workspace, { recursive: true, force: true });
    }
  });
});

describe("runTsJsPack deterministic signals", () => {
  it("detects entrypoints from scripts, Next app router, and common files", () => {
    const workspace = writeWorkspace({
      "package.json": JSON.stringify(
        {
          scripts: {
            dev: "node ./src/bootstrap.ts",
            start: "node src/server.ts",
            build: "next build",
          },
        },
        null,
        2
      ),
      "src/bootstrap.ts": "export const boot = true;\n",
      "src/server.ts": "export const server = true;\n",
      "src/util.ts": "export const util = true;\n",
      "src/app/page.tsx": "export default function Page() { return null; }\n",
      "src/app/layout.tsx": "export default function Layout() { return null; }\n",
      "src/app/api/health/route.ts": "export async function GET() { return new Response('ok'); }\n",
    });

    const bootstrap = relKey("src", "bootstrap.ts");
    const server = relKey("src", "server.ts");
    const util = relKey("src", "util.ts");
    const page = relKey("src", "app", "page.tsx");
    const layout = relKey("src", "app", "layout.tsx");
    const route = relKey("src", "app", "api", "health", "route.ts");
    const pipeline = buildPipeline([bootstrap, server, util, page, layout, route]);

    try {
      const result = runTsJsPack(workspace, pipeline);
      expect(result.entrypoints.has(bootstrap)).toBe(true);
      expect(result.entrypoints.has(server)).toBe(true);
      expect(result.entrypoints.has(page)).toBe(true);
      expect(result.entrypoints.has(layout)).toBe(true);
      expect(result.entrypoints.has(route)).toBe(true);
      expect(result.entrypoints.has(util)).toBe(false);
    } finally {
      fs.rmSync(workspace, { recursive: true, force: true });
    }
  });

  it("computes deterministic test proximity scores", () => {
    const workspace = writeWorkspace({
      "src/feature/service.ts": "export const service = 1;\n",
      "src/feature/service.test.ts": "test('x', () => {});\n",
      "src/logic/task.ts": "export const task = 1;\n",
      "src/logic/__tests__/task.spec.ts": "test('x', () => {});\n",
      "src/core/other.ts": "export const other = 1;\n",
      "tests/core/other.test.ts": "test('x', () => {});\n",
      "src/uncovered/noTest.ts": "export const none = 1;\n",
    });

    const service = relKey("src", "feature", "service.ts");
    const serviceTest = relKey("src", "feature", "service.test.ts");
    const task = relKey("src", "logic", "task.ts");
    const taskTest = relKey("src", "logic", "__tests__", "task.spec.ts");
    const other = relKey("src", "core", "other.ts");
    const otherTest = relKey("tests", "core", "other.test.ts");
    const noTest = relKey("src", "uncovered", "noTest.ts");
    const pipeline = buildPipeline([
      service,
      serviceTest,
      task,
      taskTest,
      other,
      otherTest,
      noTest,
    ]);

    try {
      const result = runTsJsPack(workspace, pipeline);
      expect(result.testProximity?.get(service)).toBe(100);
      expect(result.testProximity?.get(task)).toBe(90);
      expect(result.testProximity?.get(other)).toBe(80);
      expect(result.testProximity?.get(noTest)).toBe(0);
    } finally {
      fs.rmSync(workspace, { recursive: true, force: true });
    }
  });

  it("captures loc and nesting in complexity proxy", () => {
    const workspace = writeWorkspace({
      "src/simple.ts": "export function a() {\n  return 1;\n}\n",
      "src/complex.ts":
        "export function b(v: number) {\n  if (v > 0) {\n    for (let i = 0; i < v; i++) {\n      if (i % 2 === 0) {\n        while (false) {\n          // noop\n        }\n      }\n    }\n  }\n  return v;\n}\n",
    });

    const simple = relKey("src", "simple.ts");
    const complex = relKey("src", "complex.ts");
    const pipeline = buildPipeline([simple, complex]);

    try {
      const result = runTsJsPack(workspace, pipeline);
      expect((result.loc?.get(complex) ?? 0)).toBeGreaterThan(
        result.loc?.get(simple) ?? 0
      );
      expect((result.maxNesting?.get(complex) ?? 0)).toBeGreaterThan(
        result.maxNesting?.get(simple) ?? 0
      );
      expect((result.complexity.get(complex) ?? 0)).toBeGreaterThan(
        result.complexity.get(simple) ?? 0
      );
    } finally {
      fs.rmSync(workspace, { recursive: true, force: true });
    }
  });

  it("reduces architecture to folder-level graph with deterministic warnings", () => {
    const workspace = writeWorkspace({
      [relKey("src", "a", "file.ts")]:
        'import { helper } from "./helper";\nimport { b } from "../b/file";\nvoid helper; void b;\n',
      [relKey("src", "a", "helper.ts")]: "export const helper = 1;\n",
      [relKey("src", "b", "file.ts")]: "export const b = 1;\n",
    });

    const aFile = relKey("src", "a", "file.ts");
    const aHelper = relKey("src", "a", "helper.ts");
    const bFile = relKey("src", "b", "file.ts");
    const pipeline = buildPipeline([aFile, aHelper, bFile]);

    try {
      const result = runTsJsPack(workspace, pipeline);
      const nodeIds = new Set(
        result.architecture.nodes.map((n) => normalizeKey(n.id))
      );

      expect(nodeIds.has("src/a")).toBe(true);
      expect(nodeIds.has("src/b")).toBe(true);
      expect(nodeIds.has(normalizeKey(aFile))).toBe(false);
      expect(result.architecture.nodes.every((n) => n.type === "folder")).toBe(true);
      expect(
        result.architecture.edges.some(
          (edge) =>
            normalizeKey(edge.from) === "src/a" &&
            normalizeKey(edge.to) === "src/b" &&
            edge.type === "import"
        )
      ).toBe(true);
      expect(result.warnings?.some((w) => w.includes("reduced from file-level"))).toBe(
        true
      );
    } finally {
      fs.rmSync(workspace, { recursive: true, force: true });
    }
  });

  it("caps architecture folder nodes and emits cap warning", () => {
    const files: Record<string, string> = {};
    const filePaths: string[] = [];
    const folderCount = 55;

    for (let i = 0; i < folderCount; i++) {
      const current = relKey("src", `f${i}`, "main.ts");
      const nextImport =
        i < folderCount - 1 ? `import "../f${i + 1}/main";\n` : "";
      files[current] = `${nextImport}export const v${i} = ${i};\n`;
      filePaths.push(current);
    }

    const workspace = writeWorkspace(files);
    const pipeline = buildPipeline(filePaths);

    try {
      const result = runTsJsPack(workspace, pipeline);
      expect(result.architecture.nodes.length).toBe(50);
      expect(result.warnings?.some((w) => w.includes("nodes capped at 50"))).toBe(true);
    } finally {
      fs.rmSync(workspace, { recursive: true, force: true });
    }
  });
});
