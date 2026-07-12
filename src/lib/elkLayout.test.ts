import { describe, expect, it } from "vitest";
import type { Architecture } from "@/types/report";
import { layoutGraph } from "./elkLayout";

describe("layoutGraph", () => {
  it("filters invalid edges and returns routed node and edge geometry", async () => {
    const architecture: Architecture = {
      nodes: [
        { id: "root", label: "Root", type: "folder" },
        { id: "child", label: "Child", type: "file" },
      ],
      edges: [
        { from: "root", to: "child", type: "import" },
        { from: "root", to: "root", type: "dependency" },
        { from: "missing", to: "child", type: "import" },
      ],
    };

    const result = await layoutGraph(architecture);

    expect(result.nodes.map((node) => node.id).sort()).toEqual(["child", "root"]);
    expect(result.nodes.every((node) => node.width >= 100 && node.height === 40)).toBe(true);
    expect(result.edges).toHaveLength(1);
    expect(result.edges[0]).toMatchObject({ from: "root", to: "child", type: "import" });
    expect(result.edges[0]?.path.length).toBeGreaterThanOrEqual(2);
    expect(result.width).toBeGreaterThan(0);
    expect(result.height).toBeGreaterThan(0);
  });

  it("handles a graph with no valid edges", async () => {
    const result = await layoutGraph({
      nodes: [{ id: "only", label: "Only" }],
      edges: [{ from: "only", to: "only" }],
    });

    expect(result.nodes).toHaveLength(1);
    expect(result.edges).toEqual([]);
    expect(result.width).toBeGreaterThan(0);
    expect(result.height).toBeGreaterThan(0);
  });
});
