import { describe, expect, it } from "vitest";
import type { Architecture } from "@/types/report";
import { analyzeArchitectureBoundaries } from "./boundaries";

function architecture(
  nodeIds: string[],
  edges: Architecture["edges"] = []
): Architecture {
  return {
    nodes: nodeIds.map((id) => ({ id, label: id, type: "file" })),
    edges,
  };
}

describe("analyzeArchitectureBoundaries", () => {
  it("returns bounded empty insights for an empty graph", () => {
    expect(analyzeArchitectureBoundaries(architecture([]))).toEqual({
      layers: [],
      violations: [],
      circular_deps: [],
      hubs: [],
    });
  });

  it("keeps sparse repository evidence without inventing hubs or violations", () => {
    const result = analyzeArchitectureBoundaries(
      architecture(
        ["src/app/page.ts", "src/lib/data.ts"],
        [{ from: "src/lib/data.ts", to: "src/app/page.ts", type: "import" }]
      )
    );

    expect(result).toEqual({
      layers: ["app", "lib"],
      violations: [],
      circular_deps: [],
      hubs: [],
    });
  });

  it("does not let duplicate or missing-endpoint edges inflate evidence", () => {
    const result = analyzeArchitectureBoundaries(
      architecture(
        ["src/app/a.ts", "src/app/b.ts", "src/lib/core.ts"],
        [
          { from: "src/app/a.ts", to: "src/lib/core.ts" },
          { from: "src/app/a.ts", to: "src/lib/core.ts" },
          { from: "src/app/b.ts", to: "src/lib/core.ts" },
          { from: "src/app/missing.ts", to: "src/lib/core.ts" },
          { from: "src/app/a.ts", to: "src/api/missing.ts" },
        ]
      )
    );

    expect(result.hubs).toEqual([]);
    expect(result.violations).toEqual([
      {
        from: "src/app/a.ts",
        to: "src/lib/core.ts",
        reason: "Import from lib into app may cross layer boundaries",
      },
      {
        from: "src/app/b.ts",
        to: "src/lib/core.ts",
        reason: "Import from lib into app may cross layer boundaries",
      },
    ]);
  });

  it("normalizes Windows paths before matching and deduplicating edges", () => {
    const result = analyzeArchitectureBoundaries(
      architecture(
        ["src\\app\\page.ts", "src\\lib\\core.ts"],
        [
          { from: "src\\app\\page.ts", to: "src\\lib\\core.ts" },
          { from: "src/app/page.ts", to: "src/lib/core.ts" },
        ]
      )
    );

    expect(result.layers).toEqual(["app", "lib"]);
    expect(result.hubs).toEqual([]);
    expect(result.violations).toEqual([
      {
        from: "src/app/page.ts",
        to: "src/lib/core.ts",
        reason: "Import from lib into app may cross layer boundaries",
      },
    ]);
  });

  it("ranks tied hubs deterministically and caps the result at five", () => {
    const targets = [
      "src/lib/zeta.ts",
      "src/lib/bravo.ts",
      "src/lib/alpha.ts",
      "src/lib/foxtrot.ts",
      "src/lib/charlie.ts",
      "src/lib/delta.ts",
    ];
    const sources = ["src/api/one.ts", "src/api/two.ts", "src/api/three.ts"];
    const edges = targets.flatMap((to) => sources.map((from) => ({ from, to })));

    const result = analyzeArchitectureBoundaries(
      architecture([...sources, ...targets], edges)
    );

    expect(result.hubs).toEqual([
      "src/lib/alpha.ts",
      "src/lib/bravo.ts",
      "src/lib/charlie.ts",
      "src/lib/delta.ts",
      "src/lib/foxtrot.ts",
    ]);
  });

  it("caps evidence-backed violations at ten", () => {
    const sources = Array.from({ length: 12 }, (_, index) => `src/app/${index}.ts`);
    const target = "src/api/client.ts";
    const result = analyzeArchitectureBoundaries(
      architecture(
        [...sources, target],
        sources.map((from) => ({ from, to: target }))
      )
    );

    expect(result.violations).toHaveLength(10);
    expect(result.violations[0]).toMatchObject({ from: "src/app/0.ts", to: target });
    expect(result.violations[9]).toMatchObject({ from: "src/app/9.ts", to: target });
  });

  it("rejects unsupported, same-layer, and reverse-order layer pairs", () => {
    const result = analyzeArchitectureBoundaries(
      architecture(
        [
          "src/feature/entry.ts",
          "src/lib/a.ts",
          "src/lib/b.ts",
          "src/app/page.ts",
        ],
        [
          { from: "src/feature/entry.ts", to: "src/lib/a.ts" },
          { from: "src/lib/a.ts", to: "src/feature/entry.ts" },
          { from: "src/lib/a.ts", to: "src/lib/b.ts" },
          { from: "src/lib/a.ts", to: "src/app/page.ts" },
        ]
      )
    );

    expect(result.violations).toEqual([]);
  });
});
