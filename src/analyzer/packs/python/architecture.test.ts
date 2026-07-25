import { describe, expect, it } from "vitest";
import { buildReducedArchitecture } from "./architecture";

function importMap(
  relationships: Array<[string, string[]]>
): Map<string, Set<string>> {
  return new Map(
    relationships.map(([from, targets]) => [from, new Set(targets)])
  );
}

describe("buildReducedArchitecture", () => {
  it("returns an empty graph when no indexed Python files exist", () => {
    expect(
      buildReducedArchitecture(
        [],
        importMap([["missing/source.py", ["missing/target.py"]]])
      )
    ).toEqual({
      architecture: { nodes: [], edges: [] },
      warnings: [],
    });
  });

  it("reduces a single folder to one source-backed self-link", () => {
    expect(
      buildReducedArchitecture(
        ["main.py", "helpers.py"],
        importMap([
          ["main.py", ["helpers.py"]],
          ["helpers.py", ["helpers.py"]],
        ])
      )
    ).toEqual({
      architecture: {
        nodes: [{ id: ".", label: ".", type: "folder" }],
        edges: [{ from: ".", to: ".", type: "import" }],
      },
      warnings: [
        "Architecture reduced from file-level (2 files) to folder-level (1 folders).",
      ],
    });
  });

  it("normalizes Windows paths and keeps only indexed endpoints", () => {
    const result = buildReducedArchitecture(
      ["src\\app.py", "lib\\helpers.py", "unused\\module.py"],
      importMap([
        ["src\\app.py", ["lib/helpers.py", "outside/target.py"]],
        ["outside/source.py", ["unused/module.py"]],
      ])
    );

    expect(result.architecture).toEqual({
      nodes: [
        { id: "lib", label: "lib", type: "folder" },
        { id: "src", label: "src", type: "folder" },
        { id: "unused", label: "unused", type: "folder" },
      ],
      edges: [{ from: "src", to: "lib", type: "import" }],
    });
    expect(result.warnings).toEqual([]);
  });

  it("deduplicates indexed files and equivalent file relationships", () => {
    const result = buildReducedArchitecture(
      [
        "z/source.py",
        "z\\source.py",
        "a/target.py",
        "b/source.py",
        "c/target.py",
      ],
      importMap([
        ["z/source.py", ["a/target.py", "a\\target.py"]],
        ["z\\source.py", ["a/target.py"]],
        ["b/source.py", ["c/target.py"]],
      ])
    );

    expect(result.architecture.nodes.map((node) => node.id)).toEqual([
      "a",
      "b",
      "c",
      "z",
    ]);
    expect(result.architecture.edges).toEqual([
      { from: "b", to: "c", type: "import" },
      { from: "z", to: "a", type: "import" },
    ]);
    expect(result.warnings).toEqual([]);
  });

  it("orders sparse tied folders by path regardless of input order", () => {
    const files = ["z/module.py", "a/module.py", "m/module.py"];
    const first = buildReducedArchitecture(files, new Map());
    const second = buildReducedArchitecture([...files].reverse(), new Map());

    expect(first).toEqual(second);
    expect(first.architecture.nodes.map((node) => node.id)).toEqual([
      "a",
      "m",
      "z",
    ]);
  });

  it("uses unique relationship weights before file counts and path ties", () => {
    const result = buildReducedArchitecture(
      [
        "app/one.py",
        "app/two.py",
        "lib/one.py",
        "lib/two.py",
        "other/source.py",
        "shared/target.py",
        "wide/one.py",
        "wide/two.py",
      ],
      importMap([
        ["app/one.py", ["lib/one.py"]],
        ["app/two.py", ["lib/two.py"]],
        ["other/source.py", ["shared/target.py"]],
      ])
    );

    expect(result.architecture.nodes.map((node) => node.id)).toEqual([
      "app",
      "lib",
      "other",
      "shared",
      "wide",
    ]);
    expect(result.architecture.edges).toEqual([
      { from: "app", to: "lib", type: "import" },
      { from: "other", to: "shared", type: "import" },
    ]);
  });

  it("caps tied folder nodes deterministically with truthful warnings", () => {
    const files = Array.from(
      { length: 51 },
      (_, index) => `folder-${String(index).padStart(2, "0")}/module.py`
    );
    const first = buildReducedArchitecture(files, new Map());
    const second = buildReducedArchitecture([...files].reverse(), new Map());

    expect(first).toEqual(second);
    expect(first.architecture.nodes).toHaveLength(50);
    expect(first.architecture.nodes[0].id).toBe("folder-00");
    expect(first.architecture.nodes.at(-1)?.id).toBe("folder-49");
    expect(first.warnings).toEqual([
      "Architecture nodes capped at 50 folders (from 51).",
      "Architecture reduced from file-level (51 files) to folder-level (50 folders).",
    ]);
  });

  it("caps tied folder links deterministically with truthful warnings", () => {
    const files = Array.from(
      { length: 21 },
      (_, index) => `folder-${String(index).padStart(2, "0")}/module.py`
    );
    const relationships = files.map(
      (from): [string, string[]] => [from, files.filter((to) => to !== from)]
    );
    const reversedRelationships = [...relationships]
      .reverse()
      .map(([from, targets]): [string, string[]] => [
        from,
        [...targets].reverse(),
      ]);

    const first = buildReducedArchitecture(files, importMap(relationships));
    const second = buildReducedArchitecture(
      [...files].reverse(),
      importMap(reversedRelationships)
    );

    expect(first).toEqual(second);
    expect(first.architecture.edges).toHaveLength(200);
    expect(first.architecture.edges[0]).toEqual({
      from: "folder-00",
      to: "folder-01",
      type: "import",
    });
    expect(first.warnings).toEqual([
      "Architecture edges capped at 200 links (from 420).",
    ]);
  });
});
