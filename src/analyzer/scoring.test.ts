import { describe, it, expect } from "vitest";
import { computeStartHere, computeDangerZones } from "./scoring";
import { MAX_DANGER_ZONE_ITEMS } from "@/lib/ingestLimits";
import type { CommitInsights } from "@/types/report";
import type { FileMetadata, IndexingPipelineResult } from "./pipeline";
import type { TsJsPackResult } from "./packs/tsjs";

function mockPipeline(overrides?: Partial<IndexingPipelineResult>): IndexingPipelineResult {
  return {
    folder_map: { path: ".", type: "dir", children: [] },
    run_commands: [],
    contribute_signals: { key_docs: [], ci_configs: [] },
    file_metadata: new Map(),
    key_docs: [],
    ci_configs: [],
    warnings: [],
    ...overrides,
  };
}

function mockMetadata(
  paths: string[],
  sizes: Record<string, number> = {}
): Map<string, FileMetadata> {
  return new Map(
    paths.map((filePath, index) => {
      const extension = filePath.includes(".") ? `.${filePath.split(".").pop()}` : "";
      const language =
        extension === ".py" ? "python" : extension === ".java" ? "java" : "typescript";
      return [
        filePath,
        {
          path: filePath,
          size: sizes[filePath] ?? 100 + index,
          extension,
          language,
        },
      ];
    })
  );
}

function mockPack(overrides?: Partial<TsJsPackResult>): TsJsPackResult {
  return {
    architecture: { nodes: [], edges: [] },
    imports: new Map(),
    fanIn: new Map(),
    fanOut: new Map(),
    entrypoints: new Set(),
    testFiles: new Set(),
    complexity: new Map(),
    testProximity: new Map(),
    ...overrides,
  };
}

describe("computeStartHere", () => {
  it("includes README with deterministic evidence text", () => {
    const pipeline = mockPipeline({ key_docs: ["README.md"] });
    const result = computeStartHere(pipeline, null);
    const readme = result.find((r) => r.path === "README.md");
    expect(readme).toBeDefined();
    expect(readme?.explanation).toContain("root README documentation");
  });

  it("returns empty for empty pipeline", () => {
    const pipeline = mockPipeline();
    const result = computeStartHere(pipeline, null);
    expect(result).toEqual([]);
  });

  it("ranks entrypoints, routes, and central modules with normalized scores", () => {
    const pipeline = mockPipeline({
      key_docs: ["README.md", "CONTRIBUTING.md"],
      file_metadata: new Map([
        ["src/app/page.tsx", { path: "src/app/page.tsx", size: 200, extension: ".tsx", language: "typescript" }],
        ["src/app/api/health/route.ts", { path: "src/app/api/health/route.ts", size: 140, extension: ".ts", language: "typescript" }],
        ["src/router.ts", { path: "src/router.ts", size: 90, extension: ".ts", language: "typescript" }],
        ["src/lib/core.ts", { path: "src/lib/core.ts", size: 280, extension: ".ts", language: "typescript" }],
      ]),
    });

    const mockTsJs = {
      architecture: { nodes: [], edges: [] },
      imports: new Map<string, Set<string>>([
        ["src/app/page.tsx", new Set(["src/lib/core.ts"])],
        ["src/app/api/health/route.ts", new Set(["src/lib/core.ts"])],
        ["src/router.ts", new Set(["src/lib/core.ts"])],
        ["src/lib/core.ts", new Set()],
      ]),
      fanIn: new Map([
        ["src/app/page.tsx", 0],
        ["src/app/api/health/route.ts", 0],
        ["src/router.ts", 0],
        ["src/lib/core.ts", 3],
      ]),
      fanOut: new Map([
        ["src/app/page.tsx", 1],
        ["src/app/api/health/route.ts", 1],
        ["src/router.ts", 1],
        ["src/lib/core.ts", 0],
      ]),
      entrypoints: new Set<string>(["src/app/page.tsx", "src/app/api/health/route.ts"]),
      testFiles: new Set<string>(),
      complexity: new Map([
        ["src/app/page.tsx", 2],
        ["src/app/api/health/route.ts", 2],
        ["src/router.ts", 1],
        ["src/lib/core.ts", 5],
      ]),
    };

    const result = computeStartHere(pipeline, mockTsJs);
    expect(result.length).toBeGreaterThan(0);
    expect(result.every((item) => item.score >= 0 && item.score <= 100)).toBe(true);

    const page = result.find((r) => r.path === "src/app/page.tsx");
    const route = result.find((r) => r.path === "src/app/api/health/route.ts");
    const core = result.find((r) => r.path === "src/lib/core.ts");
    const readme = result.find((r) => r.path === "README.md");

    expect(page?.explanation).toContain("detected entrypoint");
    expect(route?.explanation).toContain("Next.js route handler");
    expect(core?.explanation).toContain("imported by 3 files");
    expect(core?.explanation).toContain("directly imported by an entrypoint");
    expect(readme?.explanation).toContain("root README documentation");
  });

  it("classifies every documentation fallback and keeps equal scores path-stable", () => {
    const pipeline = mockPipeline({
      key_docs: [
        "packages/docs/README-guide.md",
        "CONTRIBUTING.md",
        "packages/docs/architecture.md",
        "packages/docs/operations.md",
      ],
    });

    const result = computeStartHere(pipeline);

    expect(result.map((item) => item.path)).toEqual([
      "packages/docs/README-guide.md",
      "CONTRIBUTING.md",
      "packages/docs/architecture.md",
      "packages/docs/operations.md",
    ]);
    expect(result[0].explanation).toBe("README documentation; project docs reference");
    expect(result[1].explanation).toBe("contribution guide");
    expect(result[2].explanation).toBe("key project documentation; project docs reference");
    expect(result[2].score).toBe(result[3].score);
  });

  it("recognizes root App Router files and bounded TypeScript graph signals", () => {
    const files = [
      "app/api/health/route.ts",
      "app/page.tsx",
      "app/layout.tsx",
      "router.ts",
      "src/direct.ts",
      "src/two-hops.ts",
      "src/four-hops.ts",
      "src/leaf.ts",
      "src/direct.test.ts",
      "src/__tests__/router.spec.ts",
    ];
    const pipeline = mockPipeline({ file_metadata: mockMetadata(files) });
    const tsjs = mockPack({
      imports: new Map([
        ["app/page.tsx", new Set(["src/direct.ts"])],
        ["src/direct.ts", new Set(["src/two-hops.ts"])],
        ["src/two-hops.ts", new Set(["src/leaf.ts"])],
        ["src/leaf.ts", new Set(["src/four-hops.ts"])],
      ]),
      fanIn: new Map([
        ["router.ts", 20],
        ["src/direct.test.ts", 1],
        ["src/__tests__/router.spec.ts", 1],
      ]),
      entrypoints: new Set(["app/page.tsx"]),
    });

    const result = computeStartHere(pipeline, tsjs);
    const explanation = (filePath: string) =>
      result.find((item) => item.path === filePath)?.explanation ?? "";

    expect(explanation("app/api/health/route.ts")).toContain("Next.js route handler");
    expect(explanation("app/page.tsx")).toContain("Next.js page entry");
    expect(explanation("app/layout.tsx")).toContain("Next.js layout entry");
    expect(explanation("router.ts")).toContain("router module");
    expect(explanation("router.ts")).toContain("imported by 20 files");
    expect(explanation("src/direct.ts")).toContain("directly imported by an entrypoint");
    expect(explanation("src/two-hops.ts")).toContain("within 2 import hops of an entrypoint");
    expect(explanation("src/leaf.ts")).toContain("within 3 import hops of an entrypoint");
    expect(explanation("src/four-hops.ts")).toBe("");
    expect(explanation("src/direct.test.ts")).toBe("");
    expect(explanation("src/__tests__/router.spec.ts")).toBe("");
    expect(result).toHaveLength(7);
  });

  it("covers Python entry conventions, import distance, fan-in, and test penalties", () => {
    const files = [
      "pkg/__main__.py",
      "manage.py",
      "main.py",
      "app.py",
      "server.py",
      "cli.py",
      "config/settings.py",
      "config/urls.py",
      "pkg/direct.py",
      "pkg/two_hops.py",
      "pkg/leaf.py",
      "tests/test_worker.py",
      "pkg/worker_test.py",
    ];
    const pipeline = mockPipeline({ file_metadata: mockMetadata(files) });
    const python = mockPack({
      imports: new Map([
        ["pkg/__main__.py", new Set(["pkg/direct.py"])],
        ["pkg/direct.py", new Set(["pkg/two_hops.py"])],
        ["pkg/two_hops.py", new Set(["pkg/leaf.py"])],
      ]),
      fanIn: new Map([
        ["pkg/direct.py", 2],
        ["tests/test_worker.py", 1],
        ["pkg/worker_test.py", 1],
      ]),
      entrypoints: new Set(["pkg/__main__.py"]),
    });

    const result = computeStartHere(pipeline, null, python);
    const explanation = (filePath: string) =>
      result.find((item) => item.path === filePath)?.explanation ?? "";

    expect(explanation("pkg/__main__.py")).toContain("runnable module (__main__.py)");
    expect(explanation("manage.py")).toContain("Django management command");
    expect(explanation("main.py")).toContain("common entry file");
    expect(explanation("app.py")).toContain("application entry file");
    expect(explanation("server.py")).toContain("application entry file");
    expect(explanation("cli.py")).toContain("CLI entry file");
    expect(explanation("config/settings.py")).toContain("Django settings module");
    expect(explanation("config/urls.py")).toContain("Django routing configuration");
    expect(explanation("pkg/direct.py")).toContain("directly imported by an entrypoint");
    expect(explanation("pkg/two_hops.py")).toContain("within 2 import hops of an entrypoint");
    expect(explanation("pkg/leaf.py")).toContain("within 3 import hops of an entrypoint");
    expect(explanation("tests/test_worker.py")).toBe("");
    expect(explanation("pkg/worker_test.py")).toBe("");
    expect(result).toHaveLength(11);
  });

  it("covers Java build definitions, entrypoint distance, and test penalties", () => {
    const files = [
      "pom.xml",
      "build.gradle.kts",
      "settings.gradle",
      "module/pom.xml",
      "src/Main.java",
      "src/Service.java",
      "src/Repository.java",
      "src/Leaf.java",
      "src/MainTest.java",
    ];
    const pipeline = mockPipeline({ file_metadata: mockMetadata(files) });
    const java = mockPack({
      imports: new Map([
        ["src/Main.java", new Set(["src/Service.java"])],
        ["src/Service.java", new Set(["src/Repository.java"])],
        ["src/Repository.java", new Set(["src/Leaf.java"])],
      ]),
      fanIn: new Map([
        ["src/Service.java", 1],
        ["src/MainTest.java", 1],
      ]),
      entrypoints: new Set(["src/Main.java"]),
    });

    const result = computeStartHere(pipeline, null, null, java);
    const explanation = (filePath: string) =>
      result.find((item) => item.path === filePath)?.explanation ?? "";

    expect(explanation("pom.xml")).toBe("Maven build definition");
    expect(explanation("build.gradle.kts")).toBe("Gradle build definition");
    expect(explanation("settings.gradle")).toBe("Gradle settings");
    expect(explanation("module/pom.xml")).toBe("");
    expect(explanation("src/Main.java")).toContain("detected entrypoint");
    expect(explanation("src/Service.java")).toContain("directly imported by an entrypoint");
    expect(explanation("src/Repository.java")).toContain("within 2 import hops of an entrypoint");
    expect(explanation("src/Leaf.java")).toContain("within 3 import hops of an entrypoint");
    expect(explanation("src/MainTest.java")).toBe("");
  });

  it("caps Start Here candidates and orders tied paths consistently", () => {
    const keyDocs = Array.from({ length: 15 }, (_, index) =>
      `packages/package-${String(index).padStart(2, "0")}/README.md`
    ).reverse();
    const result = computeStartHere(mockPipeline({ key_docs: keyDocs }));

    expect(result).toHaveLength(12);
    expect(result.map((item) => item.path)).toEqual([...keyDocs].sort().slice(0, 12));
    expect(result.every((item) => item.score === 100)).toBe(true);
  });
});

describe("computeDangerZones", () => {
  it("returns empty when no TS/JS pack", () => {
    const pipeline = mockPipeline();
    const result = computeDangerZones(pipeline, null);
    expect(result).toEqual([]);
  });

  it("ranks files by percentile risk score (0-100)", () => {
    const pipeline = mockPipeline({
      file_metadata: new Map([
        ["src/a.ts", { path: "src/a.ts", size: 100, extension: ".ts", language: "typescript" }],
        ["src/b.ts", { path: "src/b.ts", size: 200, extension: ".ts", language: "typescript" }],
      ]),
    });
    const mockTsJs = {
      architecture: { nodes: [], edges: [] },
      imports: new Map<string, Set<string>>(),
      fanIn: new Map([["src/a.ts", 1], ["src/b.ts", 0]]),
      fanOut: new Map([["src/a.ts", 0], ["src/b.ts", 0]]),
      entrypoints: new Set<string>(),
      testFiles: new Set<string>(),
      complexity: new Map([["src/a.ts", 5], ["src/b.ts", 1]]),
      loc: new Map<string, number>(),
      maxNesting: new Map<string, number>(),
      testProximity: new Map([["src/a.ts", 0], ["src/b.ts", 100]]),
      warnings: [],
    };
    const result = computeDangerZones(pipeline, mockTsJs);
    expect(result.length).toBe(2);
    expect(result[0].score).toBeGreaterThanOrEqual(result[1].score);
    expect(result.every((item) => item.score >= 0 && item.score <= 100)).toBe(true);
  });

  it("includes deterministic breakdown and explicit metrics", () => {
    const pipeline = mockPipeline({
      file_metadata: new Map([
        ["src/high.ts", { path: "src/high.ts", size: 500, extension: ".ts", language: "typescript" }],
        ["src/low.ts", { path: "src/low.ts", size: 50, extension: ".ts", language: "typescript" }],
      ]),
    });
    const mockTsJs = {
      architecture: { nodes: [], edges: [] },
      imports: new Map<string, Set<string>>(),
      fanIn: new Map([["src/high.ts", 8], ["src/low.ts", 0]]),
      fanOut: new Map([["src/high.ts", 6], ["src/low.ts", 0]]),
      entrypoints: new Set<string>(),
      testFiles: new Set<string>(),
      complexity: new Map([["src/high.ts", 20], ["src/low.ts", 1]]),
      loc: new Map<string, number>(),
      maxNesting: new Map<string, number>(),
      testProximity: new Map([["src/high.ts", 0], ["src/low.ts", 100]]),
      warnings: [],
    };

    const result = computeDangerZones(pipeline, mockTsJs);
    const high = result.find((item) => item.path === "src/high.ts");
    const low = result.find((item) => item.path === "src/low.ts");

    expect(high).toBeDefined();
    expect(low).toBeDefined();
    expect((high?.score ?? 0)).toBeGreaterThan(low?.score ?? 0);
    expect(high?.breakdown).toContain("size p");
    expect(high?.breakdown).toContain("fan-in p");
    expect(high?.breakdown).toContain("fan-out p");
    expect(high?.breakdown).toContain("complexity p");
    expect(high?.breakdown).toContain("test proximity 0");
    expect(high?.breakdown).toContain("no nearby tests");
    expect(high?.metrics).toEqual({
      size: 500,
      fan_in: 8,
      fan_out: 6,
      complexity: 20,
      test_proximity: 0,
    });
  });

  it("excludes test files from production risk ranking", () => {
    const pipeline = mockPipeline({
      file_metadata: new Map([
        ["src/service.ts", { path: "src/service.ts", size: 300, extension: ".ts", language: "typescript" }],
        ["src/service.test.ts", { path: "src/service.test.ts", size: 400, extension: ".ts", language: "typescript" }],
      ]),
    });
    const mockTsJs = {
      architecture: { nodes: [], edges: [] },
      imports: new Map<string, Set<string>>(),
      fanIn: new Map([["src/service.ts", 3], ["src/service.test.ts", 0]]),
      fanOut: new Map([["src/service.ts", 1], ["src/service.test.ts", 5]]),
      entrypoints: new Set<string>(),
      testFiles: new Set<string>(["src/service.test.ts"]),
      complexity: new Map([["src/service.ts", 8], ["src/service.test.ts", 12]]),
      loc: new Map<string, number>(),
      maxNesting: new Map<string, number>(),
      testProximity: new Map([["src/service.ts", 0], ["src/service.test.ts", 100]]),
      warnings: [],
    };

    const result = computeDangerZones(pipeline, mockTsJs);
    expect(result.map((r) => r.path)).toEqual(["src/service.ts"]);
    expect(result.some((r) => r.path === "src/service.test.ts")).toBe(false);
  });

  it(`caps results at MAX_DANGER_ZONE_ITEMS (${MAX_DANGER_ZONE_ITEMS})`, () => {
    const fileCount = MAX_DANGER_ZONE_ITEMS + 25;
    const fileMetadata = new Map<string, { path: string; size: number; extension: string; language: string }>();
    const fanIn = new Map<string, number>();
    const fanOut = new Map<string, number>();
    const complexity = new Map<string, number>();
    const testProximity = new Map<string, number>();

    for (let i = 0; i < fileCount; i++) {
      const filePath = `src/file-${i}.ts`;
      fileMetadata.set(filePath, {
        path: filePath,
        size: 100 + i,
        extension: ".ts",
        language: "typescript",
      });
      fanIn.set(filePath, i % 10);
      fanOut.set(filePath, i % 5);
      complexity.set(filePath, i % 20);
      testProximity.set(filePath, i % 100);
    }

    const pipeline = mockPipeline({ file_metadata: fileMetadata });
    const mockTsJs = {
      architecture: { nodes: [], edges: [] },
      imports: new Map<string, Set<string>>(),
      fanIn,
      fanOut,
      entrypoints: new Set<string>(),
      testFiles: new Set<string>(),
      complexity,
      loc: new Map<string, number>(),
      maxNesting: new Map<string, number>(),
      testProximity,
      warnings: [],
    };

    const result = computeDangerZones(pipeline, mockTsJs);
    expect(result).toHaveLength(MAX_DANGER_ZONE_ITEMS);
  });

  it("uses language-specific packs and missing-signal fallbacks", () => {
    const files = [
      "src/typed.ts",
      "src/typed.test.ts",
      "python/main.py",
      "python/test_main.py",
      "java/Main.java",
      "java/MainTest.java",
    ];
    const pipeline = mockPipeline({ file_metadata: mockMetadata(files) });
    const tsjs = mockPack({ testFiles: new Set(["src/typed.test.ts"]) });
    const python = mockPack({
      fanIn: new Map([["python/main.py", 2]]),
      fanOut: new Map([["python/main.py", 1]]),
      complexity: new Map([["python/main.py", 4]]),
      testFiles: new Set(["python/test_main.py"]),
      testProximity: undefined,
    });
    const java = mockPack({
      fanIn: new Map([["java/Main.java", 3]]),
      fanOut: new Map([["java/Main.java", 2]]),
      complexity: new Map([["java/Main.java", 6]]),
      testFiles: new Set(["java/MainTest.java"]),
      testProximity: new Map([["java/Main.java", 70]]),
    });

    const result = computeDangerZones(pipeline, tsjs, python, java);

    expect(result.map((item) => item.path).sort()).toEqual([
      "java/Main.java",
      "python/main.py",
      "src/typed.ts",
    ]);
    expect(result.find((item) => item.path === "src/typed.ts")?.metrics).toEqual({
      size: 100,
      fan_in: 0,
      fan_out: 0,
      complexity: 0,
      test_proximity: 0,
    });
    expect(result.find((item) => item.path === "java/Main.java")?.breakdown).toContain(
      "low test proximity"
    );
  });

  it("adds bounded churn evidence only when usable history exists", () => {
    const files = ["src/hot.ts", "src/cold.ts"];
    const pipeline = mockPipeline({
      file_metadata: mockMetadata(files, { "src/hot.ts": 800, "src/cold.ts": 80 }),
    });
    const tsjs = mockPack({
      fanIn: new Map([
        ["src/hot.ts", 8],
        ["src/cold.ts", 0],
      ]),
      fanOut: new Map([
        ["src/hot.ts", 6],
        ["src/cold.ts", 0],
      ]),
      complexity: new Map([
        ["src/hot.ts", 20],
        ["src/cold.ts", 1],
      ]),
      testProximity: new Map([
        ["src/hot.ts", 20],
        ["src/cold.ts", 100],
      ]),
    });
    const insights: CommitInsights = {
      mode: "local_git",
      recent_work_areas: ["src"],
      high_churn_files: ["src/hot.ts"],
      co_changed_pairs: [],
      evidence_refs: [],
    };

    const withChurn = computeDangerZones(pipeline, tsjs, null, null, insights);
    const withoutUsableChurn = computeDangerZones(pipeline, tsjs, null, null, {
      ...insights,
      mode: "unavailable",
    });

    expect(withChurn[0].path).toBe("src/hot.ts");
    expect(withChurn[0].breakdown).toContain("recent churn p");
    expect(withChurn[0].metrics.churn).toBe(100);
    expect(withChurn[1].metrics.churn).toBeUndefined();
    expect(withoutUsableChurn.every((item) => !item.breakdown.includes("recent churn"))).toBe(true);
  });

  it("uses a path tie-break so equivalent repositories rank identically", () => {
    const ascending = ["src/a.ts", "src/b.ts", "src/c.ts"];
    const descending = [...ascending].reverse();
    const pack = mockPack();

    const first = computeDangerZones(
      mockPipeline({ file_metadata: mockMetadata(ascending, Object.fromEntries(ascending.map((f) => [f, 100]))) }),
      pack
    );
    const second = computeDangerZones(
      mockPipeline({ file_metadata: mockMetadata(descending, Object.fromEntries(descending.map((f) => [f, 100]))) }),
      pack
    );

    expect(first.map((item) => item.path)).toEqual(ascending);
    expect(second).toEqual(first);
    expect(first.every((item) => item.score === first[0].score)).toBe(true);
  });
});
