import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Architecture } from "@/types/report";

const elkMock = vi.hoisted(() => ({
  layout: vi.fn(),
}));

vi.mock("elkjs/lib/elk.bundled.js", () => ({
  default: class MockElk {
    layout = elkMock.layout;
  },
}));

import { layoutGraph } from "./elkLayout";

const architecture: Architecture = {
  nodes: [
    { id: "root", label: "Root", type: "folder" },
    { id: "child", label: "Child", type: "file" },
  ],
  edges: [
    { from: "root", to: "child", type: "import" },
    { from: "root", to: "root", type: "dependency" },
    { from: "missing", to: "child", type: "import" },
    { from: "root", to: "missing", type: "import" },
  ],
};

describe("layoutGraph ELK output boundaries", () => {
  beforeEach(() => {
    elkMock.layout.mockReset();
  });

  it("sends only source-backed, non-self edges to ELK", async () => {
    elkMock.layout.mockImplementation(async (graph) => ({
      ...graph,
      width: 320,
      height: 240,
    }));

    const result = await layoutGraph(architecture);

    expect(elkMock.layout).toHaveBeenCalledWith(
      expect.objectContaining({
        edges: [
          {
            id: "e0",
            sources: ["root"],
            targets: ["child"],
          },
        ],
      })
    );
    expect(result.edges).toEqual([
      expect.objectContaining({
        from: "root",
        to: "child",
        type: "import",
      }),
    ]);
  });

  it("returns only nodes and edges backed by architecture evidence", async () => {
    elkMock.layout.mockResolvedValue({
      id: "root",
      children: [
        { id: "root", x: 10, y: 20, width: 120, height: 40 },
        { id: "child", x: 10, y: 100, width: 120, height: 40 },
        { id: "ghost", x: 10, y: 180, width: 120, height: 40 },
      ],
      edges: [
        { id: "e0", sources: ["root"], targets: ["child"] },
        { id: "e99", sources: ["root"], targets: ["child"] },
        { id: "e0-missing", sources: [], targets: ["child"] },
      ],
      width: 320,
      height: 240,
    });

    const result = await layoutGraph(architecture);

    expect(result.nodes.map((node) => node.id)).toEqual(["root", "child"]);
    expect(result.edges).toEqual([
      {
        from: "root",
        to: "child",
        type: "import",
        path: [],
      },
    ]);
  });

  it("uses safe node, route, and canvas defaults when ELK omits them", async () => {
    elkMock.layout.mockResolvedValue({
      id: "root",
      children: [{ id: "root" }, { id: "child" }],
      edges: [{ id: "e0", sources: ["root"], targets: ["child"] }],
    });

    await expect(layoutGraph(architecture)).resolves.toEqual({
      nodes: [
        {
          id: "root",
          label: "Root",
          type: "folder",
          x: 0,
          y: 0,
          width: 100,
          height: 40,
        },
        {
          id: "child",
          label: "Child",
          type: "file",
          x: 0,
          y: 0,
          width: 100,
          height: 40,
        },
      ],
      edges: [
        {
          from: "root",
          to: "child",
          type: "import",
          path: [],
        },
      ],
      width: 800,
      height: 600,
    });
  });

  it("keeps routed bend points in ELK drawing order", async () => {
    elkMock.layout.mockResolvedValue({
      id: "root",
      children: [
        { id: "root", x: 10, y: 20, width: 120, height: 40 },
        { id: "child", x: 10, y: 180, width: 120, height: 40 },
      ],
      edges: [
        {
          id: "e0",
          sources: ["root"],
          targets: ["child"],
          sections: [
            {
              startPoint: { x: 70, y: 60 },
              bendPoints: [
                { x: 70, y: 90 },
                { x: 90, y: 130 },
              ],
              endPoint: { x: 70, y: 180 },
            },
          ],
        },
      ],
      width: 320,
      height: 280,
    });

    const result = await layoutGraph(architecture);

    expect(result.edges[0]?.path).toEqual([
      { x: 70, y: 60 },
      { x: 70, y: 90 },
      { x: 90, y: 130 },
      { x: 70, y: 180 },
    ]);
  });

  it("handles an empty ELK result without inventing graph evidence", async () => {
    elkMock.layout.mockResolvedValue({ id: "root" });

    await expect(layoutGraph({ nodes: [], edges: [] })).resolves.toEqual({
      nodes: [],
      edges: [],
      width: 800,
      height: 600,
    });
  });
});
