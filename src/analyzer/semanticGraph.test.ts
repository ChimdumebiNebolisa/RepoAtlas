import { describe, expect, it } from "vitest";
import type { SemanticEdge, SemanticNode } from "@/types/semanticGraph";
import {
  boundSnippet,
  computeSemanticStats,
  deriveArchitectureFromSemantic,
  edgeId,
  fanMapsFromImports,
  fileNodeId,
  finalizeSemanticGraph,
  importsFromSemanticGraph,
  normalizeRelPath,
  packageNodeId,
} from "./semanticGraph";

function edge(
  from: string,
  to: string | undefined,
  resolution: SemanticEdge["resolution"] = "resolved_internal",
  id = `${from}->${to ?? resolution}`
): SemanticEdge {
  return {
    id,
    from,
    to,
    specifier: to ?? "missing",
    kind: "import",
    resolution,
    evidence: { path: from.replace(/^file:/, ""), line_start: 1, line_end: 1 },
  };
}

function graph(edges: SemanticEdge[], nodes: SemanticNode[] = []) {
  return finalizeSemanticGraph({
    language: "test",
    adapter: "direct",
    nodes,
    edges,
  });
}

describe("semantic graph helpers", () => {
  it("normalizes identifiers, evidence ids, and bounded snippets", () => {
    expect(normalizeRelPath(".\\src\\index.ts")).toBe("src/index.ts");
    expect(fileNodeId("./src/index.ts")).toBe("file:src/index.ts");
    expect(packageNodeId("react")).toBe("package:react");
    expect(
      edgeId({
        from: "file:a.ts",
        kind: "import",
        specifier: "./b",
        line: 4,
      })
    ).toBe("file:a.ts|import|./b|4|");
    expect(boundSnippet("  one \n two  ")).toBe("one two");
    expect(boundSnippet("x".repeat(121))).toBe(`${"x".repeat(119)}…`);
  });

  it("sorts finalized output and reports every resolution count", () => {
    const nodes: SemanticNode[] = [
      { id: "z", kind: "file", label: "z.ts" },
      { id: "a", kind: "entrypoint", label: "a.ts" },
    ];
    const edges = [
      edge("file:z.ts", undefined, "ignored", "z"),
      edge("file:a.ts", "package:react", "resolved_external", "b"),
      edge("file:a.ts", undefined, "unresolved", "a"),
      edge("file:a.ts", "file:z.ts", "resolved_internal", "b"),
    ];
    const result = finalizeSemanticGraph({
      language: "ts",
      adapter: "fixture",
      nodes,
      edges,
      warnings: ["z warning", "a warning"],
    });

    expect(result.nodes.map((node) => node.id)).toEqual(["a", "z"]);
    expect(result.edges.map((item) => `${item.id}:${item.from}`)).toEqual([
      "a:file:a.ts",
      "b:file:a.ts",
      "b:file:a.ts",
      "z:file:z.ts",
    ]);
    expect(result.warnings).toEqual(["a warning", "z warning"]);
    expect(result.stats).toEqual({
      node_count: 2,
      edge_count: 4,
      resolved_internal: 1,
      resolved_external: 1,
      unresolved: 1,
      ignored: 1,
      entrypoint_count: 1,
    });
    expect(computeSemanticStats([], [])).toEqual({
      node_count: 0,
      edge_count: 0,
      resolved_internal: 0,
      resolved_external: 0,
      unresolved: 0,
      ignored: 0,
      entrypoint_count: 0,
    });
  });

  it("builds internal import and fan maps without mixed node kinds", () => {
    const imports = importsFromSemanticGraph(
      graph([
        edge("file:a.ts", "file:b.ts"),
        edge("file:a.ts", "file:b.ts", "resolved_internal", "duplicate"),
        edge("file:a.ts", "package:react"),
        edge("package:workspace", "file:b.ts"),
        edge("file:a.ts", undefined),
        edge("file:a.ts", "file:c.ts", "unresolved"),
      ])
    );
    expect(imports).toEqual(new Map([["a.ts", new Set(["b.ts"])]]));

    const { fanIn, fanOut } = fanMapsFromImports(
      ["a.ts", "b.ts", "unused.ts"],
      new Map([
        ["a.ts", new Set(["b.ts", "outside.ts"])],
        ["outside.ts", new Set(["b.ts"])],
      ])
    );
    expect(Object.fromEntries(fanOut)).toEqual({
      "a.ts": 2,
      "b.ts": 0,
      "unused.ts": 0,
      "outside.ts": 1,
    });
    expect(Object.fromEntries(fanIn)).toEqual({
      "a.ts": 0,
      "b.ts": 2,
      "unused.ts": 0,
      "outside.ts": 1,
    });
  });
});

describe("semantic architecture reduction", () => {
  it("rejects internal edges whose source files are absent from inventory", () => {
    const result = deriveArchitectureFromSemantic(
      ["src/a.ts", "lib/b.ts"],
      graph([
        edge("file:src/a.ts", "file:lib/b.ts"),
        edge("file:src/stale.ts", "file:lib/missing.ts"),
      ])
    );

    expect(result.architecture.edges).toEqual([
      { from: "src", to: "lib", type: "import" },
    ]);
  });

  it("normalizes root files and orders equal folders deterministically", () => {
    const result = deriveArchitectureFromSemantic(
      ["./root.ts", "z/b.ts", "a/a.ts"],
      graph([])
    );

    expect(result.architecture.nodes.map((node) => node.id)).toEqual([
      ".",
      "a",
      "z",
    ]);
    expect(result.architecture.edges).toEqual([]);
    expect(result.warnings).toEqual([]);
  });

  it("ranks folders by source-backed degree, then file count and name", () => {
    const files = [
      "b/one.ts",
      "b/two.ts",
      "a/one.ts",
      "c/one.ts",
      "d/one.ts",
    ];
    const result = deriveArchitectureFromSemantic(
      files,
      graph([
        edge("file:a/one.ts", "file:c/one.ts"),
        edge(
          "file:a/one.ts",
          "file:c/one.ts",
          "resolved_internal",
          "a-to-c-again"
        ),
        edge("file:d/one.ts", "file:a/one.ts"),
      ])
    );

    expect(result.architecture.nodes.map((node) => node.id)).toEqual([
      "a",
      "c",
      "d",
      "b",
    ]);
    expect(result.architecture.edges).toEqual([
      { from: "a", to: "c", type: "import" },
      { from: "d", to: "a", type: "import" },
    ]);
    expect(result.warnings).toEqual([
      "Architecture reduced from file-level (5 files) to folder-level (4 folders).",
    ]);
  });

  it("caps oversized node and edge graphs with stable counts and warnings", () => {
    const folders = Array.from({ length: 51 }, (_, index) =>
      `folder-${String(index).padStart(2, "0")}`
    );
    const files = folders.map((folder) => `${folder}/index.ts`);
    const edges: SemanticEdge[] = [];
    for (let from = 0; from < 21; from += 1) {
      for (let to = 0; to < 21; to += 1) {
        if (from === to) continue;
        edges.push(
          edge(
            fileNodeId(files[from]),
            fileNodeId(files[to]),
            "resolved_internal",
            `${from}-${to}`
          )
        );
      }
    }

    const first = deriveArchitectureFromSemantic(files, graph(edges));
    const second = deriveArchitectureFromSemantic(
      [...files].reverse(),
      graph([...edges].reverse())
    );

    expect(first).toEqual(second);
    expect(first.architecture.nodes).toHaveLength(50);
    expect(first.architecture.edges).toHaveLength(200);
    expect(first.architecture.edges[0]).toEqual({
      from: "folder-00",
      to: "folder-01",
      type: "import",
    });
    expect(first.warnings).toEqual([
      "Architecture nodes capped at 50 folders (from 51).",
      "Architecture reduced from file-level (51 files) to folder-level (50 folders).",
      "Architecture edges capped at 200 links (from 420).",
    ]);
  });
});
