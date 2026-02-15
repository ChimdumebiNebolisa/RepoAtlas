import { describe, it, expect } from "vitest";
import { computeStartHere, computeDangerZones } from "./scoring";
import type { IndexingPipelineResult } from "./pipeline";

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
});
