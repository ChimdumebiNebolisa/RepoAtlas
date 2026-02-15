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
  it("includes README in start here", () => {
    const pipeline = mockPipeline({ key_docs: ["README.md"] });
    const result = computeStartHere(pipeline, null);
    expect(result.some((r) => r.path === "README.md")).toBe(true);
    expect(result.some((r) => r.explanation.includes("README"))).toBe(true);
  });

  it("returns empty for empty pipeline", () => {
    const pipeline = mockPipeline();
    const result = computeStartHere(pipeline, null);
    expect(result).toEqual([]);
  });
});

describe("computeDangerZones", () => {
  it("returns empty when no TS/JS pack", () => {
    const pipeline = mockPipeline();
    const result = computeDangerZones(pipeline, null);
    expect(result).toEqual([]);
  });

  it("ranks files by risk score", () => {
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
    };
    const result = computeDangerZones(pipeline, mockTsJs);
    expect(result.length).toBe(2);
    expect(result[0].score).toBeGreaterThanOrEqual(result[1].score);
  });
});
