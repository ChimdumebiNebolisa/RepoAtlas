import fs from "fs";
import os from "os";
import path from "path";
import { describe, expect, it } from "vitest";
import {
  runPythonPack,
  extractImportSpecifiers,
  resolveImport,
  detectPackageRoots,
  computeComplexitySignals,
  computeTestProximityScore,
} from "./python";
import { buildReducedArchitecture } from "./python/architecture";
import { detectEntrypoints } from "./python/entrypoints";
import { detectTestFiles } from "./python/signals";
import type { IndexingPipelineResult } from "../pipeline";

const normalizeKey = (value: string) => value.replace(/\\/g, "/");

function writeWorkspace(files: Record<string, string>): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "repoatlas-python-pack-"));
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
    file_metadata.set(normalizeKey(filePath), {
      path: normalizeKey(filePath),
      size: 100,
      extension: ext,
      language: "python",
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

describe("extractImportSpecifiers", () => {
  it("extracts absolute imports", () => {
    const content = `
import os
import sys
from pathlib import Path
from collections.abc import Mapping
`;
    const result = extractImportSpecifiers(content);
    expect(result).toContain("os");
    expect(result).toContain("sys");
    expect(result).toContain("pathlib");
    expect(result).toContain("collections.abc");
  });

  it("extracts from ... import including imported submodule names", () => {
    const content = "from myapp.models import get_value\nfrom myapp import utils\n";
    const result = extractImportSpecifiers(content);
    expect(result).toContain("myapp.models");
    expect(result).toContain("myapp");
    expect(result).toContain("myapp.utils");
  });

  it("extracts relative imports", () => {
    const content = "from . import utils\nfrom ..pkg import mod\n";
    const result = extractImportSpecifiers(content);
    expect(result.some((s) => s.startsWith("."))).toBe(true);
  });

  it("extracts both modules from semicolon-chained import statements (regression)", () => {
    // F-001: `import os; import sys` previously produced the malformed
    // specifier "os;" and dropped `sys` entirely.
    const result = extractImportSpecifiers("import os; import sys\nprint(os.path, sys.path)\n");
    expect(result).toContain("os");
    expect(result).toContain("sys");
    expect(result).not.toContain("os;");
    expect(result).not.toContain("import sys");

    const mixed = extractImportSpecifiers(
      "from . import a; from .mod import b\nimport json ; import csv\n"
    );
    expect(mixed).toContain(".a");
    expect(mixed).toContain(".mod.b");
    expect(mixed).toContain("json");
    expect(mixed).toContain("csv");
  });

  it("does not add an extra dot for bare relative imports (regression)", () => {
    // `from . import x` must produce ".x" (current package), not "..x" (parent).
    expect(extractImportSpecifiers("from . import x\n")).toContain(".x");
    expect(extractImportSpecifiers("from . import x\n")).not.toContain("..x");
    // `from .. import y` must produce "..y", not "...y".
    expect(extractImportSpecifiers("from .. import y\n")).toContain("..y");
    expect(extractImportSpecifiers("from .. import y\n")).not.toContain("...y");
    // Package-qualified relative imports keep the separating dot.
    expect(extractImportSpecifiers("from .pkg import mod\n")).toContain(".pkg.mod");
    expect(extractImportSpecifiers("from ..pkg import mod\n")).toContain("..pkg.mod");
  });

  it("resolves `from . import x` to a sibling module (regression)", () => {
    const workspace = writeWorkspace({
      "app/views.py": "from . import models",
      "app/models.py": "x = 1",
    });
    const fileSet = new Set(["app/views.py", "app/models.py"]);
    try {
      const specs = extractImportSpecifiers("from . import models\n");
      const modelsSpec = specs.find((s) => s.endsWith("models"))!;
      const resolved = resolveImport("app/views.py", modelsSpec, workspace, [""], fileSet);
      expect(normalizeKey(resolved!)).toBe("app/models.py");
    } finally {
      fs.rmSync(workspace, { recursive: true, force: true });
    }
  });

  it("deduplicates aliases, ignores wildcards, and rejects bare-parenthesized imports", () => {
    const content = [
      "import alpha as first, beta as second",
      "import alpha",
      "import (gamma, delta)",
      "from .pkg import useful as renamed, *",
    ].join("\n");
    expect(extractImportSpecifiers(content)).toEqual([
      "alpha",
      "beta",
      ".pkg",
      ".pkg.useful",
    ]);
  });

  it("handles parenthesized imports with comments", () => {
    const content = "from pkg import (\n  # note\n  foo,\n  bar,\n)\n";
    expect(extractImportSpecifiers(content)).toEqual(["pkg", "pkg.foo", "pkg.bar"]);
  });

  it("follows line-continued from/import forms", () => {
    expect(extractImportSpecifiers("from pkg \\\nimport name\n")).toEqual([
      "pkg",
      "pkg.name",
    ]);
  });
});

describe("nested test directory detection", () => {
  it("marks files under a nested tests/ directory as tests (regression)", () => {
    const workspace = writeWorkspace({
      "pkg/service.py": "def run(): return 1",
      "pkg/tests/test_service.py": "def test_run(): pass",
      "pkg/nested/deep_test.py": "def test_deep(): pass",
    });
    const pipeline = buildPipeline([
      "pkg/service.py",
      "pkg/tests/test_service.py",
      "pkg/nested/deep_test.py",
    ]);
    try {
      const result = runPythonPack(workspace, pipeline);
      expect(result.testFiles.has("pkg/tests/test_service.py")).toBe(true);
      expect(result.testFiles.has("pkg/nested/deep_test.py")).toBe(true);
      expect(result.testFiles.has("pkg/service.py")).toBe(false);
    } finally {
      fs.rmSync(workspace, { recursive: true, force: true });
    }
  });
});

describe("detectPackageRoots", () => {
  it("includes root when no src layout", () => {
    const workspace = writeWorkspace({
      "main.py": "print(1)",
    });
    try {
      const roots = detectPackageRoots(workspace);
      expect(roots).toContain("");
    } finally {
      fs.rmSync(workspace, { recursive: true, force: true });
    }
  });

  it("includes src/ when pyproject suggests src layout", () => {
    const workspace = writeWorkspace({
      "pyproject.toml": "[tool.setuptools.packages.find]\nwhere = [\"src\"]",
      "src/myapp/__init__.py": "",
    });
    try {
      const roots = detectPackageRoots(workspace);
      expect(roots).toContain("src/");
    } finally {
      fs.rmSync(workspace, { recursive: true, force: true });
    }
  });

  it("detects src layouts from setup.py and nested package files", () => {
    const setupWorkspace = writeWorkspace({
      "setup.py": "setup(packages=find_packages('src'))",
    });
    const nestedWorkspace = writeWorkspace({
      "src/deep/pkg/__init__.py": "",
    });
    try {
      expect(detectPackageRoots(setupWorkspace)).toEqual(["src/", ""]);
      expect(detectPackageRoots(nestedWorkspace)).toEqual(["src/", ""]);
    } finally {
      fs.rmSync(setupWorkspace, { recursive: true, force: true });
      fs.rmSync(nestedWorkspace, { recursive: true, force: true });
    }
  });
});

describe("resolveImport", () => {
  it("resolves absolute import to file in repo", () => {
    const workspace = writeWorkspace({
      "myapp/__init__.py": "",
      "myapp/utils.py": "def x(): pass",
    });
    const fileSet = new Set(["myapp/__init__.py", "myapp/utils.py"]);
    const roots = [""];
    try {
      const resolved = resolveImport(
        "myapp/__init__.py",
        "myapp.utils",
        workspace,
        roots,
        fileSet
      );
      expect(resolved).toBe("myapp/utils.py");
    } finally {
      fs.rmSync(workspace, { recursive: true, force: true });
    }
  });

  it("resolves relative import .utils from same package", () => {
    const workspace = writeWorkspace({
      "src/app/views.py": "from . import models",
      "src/app/models.py": "",
    });
    const fileSet = new Set(["src/app/views.py", "src/app/models.py"]);
    const roots = ["src/"];
    try {
      const resolved = resolveImport(
        "src/app/views.py",
        ".models",
        workspace,
        roots,
        fileSet
      );
      expect(normalizeKey(resolved!)).toBe("src/app/models.py");
    } finally {
      fs.rmSync(workspace, { recursive: true, force: true });
    }
  });

  it("resolves package imports and returns null for external modules", () => {
    const workspace = writeWorkspace({
      "src/pkg/__init__.py": "",
      "src/pkg/child.py": "",
    });
    const fileSet = new Set(["src/pkg/__init__.py", "src/pkg/child.py"]);
    try {
      expect(resolveImport("src/pkg/child.py", "pkg", workspace, ["src/"], fileSet)).toBe(
        "src/pkg/__init__.py"
      );
      expect(resolveImport("src/pkg/child.py", "external", workspace, ["src/"], fileSet)).toBeNull();
      expect(resolveImport("src/pkg/child.py", "..missing", workspace, ["src/"], fileSet)).toBeNull();
    } finally {
      fs.rmSync(workspace, { recursive: true, force: true });
    }
  });
});

describe("detectEntrypoints", () => {
  it("combines conventional, pyproject, and setup entrypoints", () => {
    const workspace = writeWorkspace({
      "main.py": "print('ready')",
      "src/pkg/cli.py": "",
      "pkg/tool.py": "",
      "pyproject.toml": "[project.scripts]\nrun = 'pkg.cli:start'",
      "setup.py": "entry_points={'console_scripts': ['tool=pkg.tool:main']}",
    });
    try {
      expect(
        Array.from(
          detectEntrypoints(["main.py", "src/pkg/cli.py", "pkg/tool.py"], workspace)
        )
      ).toEqual(["main.py", "src/pkg/cli.py", "pkg/tool.py"]);
    } finally {
      fs.rmSync(workspace, { recursive: true, force: true });
    }
  });
});

describe("computeComplexitySignals", () => {
  it("keeps established executable branch and nesting values", () => {
    const content = `
def complex_function(x):
    if x > 0:
        for i in range(x):
            if i % 2 == 0:
                print(i)
    else:
        return 0
`;
    const result = computeComplexitySignals(content);
    expect(result).toEqual({
      loc: 7,
      branchCount: 3,
      maxNesting: 4,
      score: 17,
    });
  });

  it("does not count else, try, finally, or with as decision points (cross-language parity)", () => {
    const content = [
      "def f(items):",
      "    for item in items:",
      "        if item:",
      "            process(item)",
      "        else:",
      "            skip(item)",
      "    try:",
      "        flush()",
      "    except ValueError:",
      "        log()",
      "    finally:",
      "        close()",
      "    with open('x') as handle:",
      "        handle.read()",
      "",
    ].join("\n");
    // for + if + except = 3 decision points, matching the TS/JS pack's count
    // for the equivalent control flow.
    const result = computeComplexitySignals(content);
    expect(result.branchCount).toBe(3);
  });

  it("excludes comment lines from LOC", () => {
    const content = "# comment\n# another\nx = 1\n";
    const result = computeComplexitySignals(content);
    expect(result.loc).toBe(1);
  });

  it("excludes comments from every complexity signal", () => {
    const executable = "def f():\n    return 1\n";
    const withComments = [
      "# if for while try except with and or",
      "def f():",
      "    # if nested:",
      "                    # while deeply nested:",
      "    return 1  # else case finally",
      "",
    ].join("\n");

    expect(computeComplexitySignals(withComments)).toEqual(
      computeComplexitySignals(executable)
    );
  });

  it("excludes triple-quoted docstrings from every complexity signal", () => {
    const executable = "def f():\n    return 1\n";
    const withDocstring = [
      "def f():",
      '    """if nested:',
      "            for item in values:",
      "                while item:",
      '                    case"""',
      "    '''try:",
      "            except RuntimeError:",
      "                finally'''",
      "    return 1",
      "",
    ].join("\n");

    expect(computeComplexitySignals(withDocstring)).toEqual(
      computeComplexitySignals(executable)
    );
  });

  it("excludes string-only lines from every complexity signal", () => {
    const executable = "def f():\n    return 1\n";
    const withStrings = [
      "def f():",
      '    "if for while try except with and or"',
      "    r'else finally match case'",
      '    f"if {1} else {2}"',
      "    return 1",
      "",
    ].join("\n");

    expect(computeComplexitySignals(withStrings)).toEqual(
      computeComplexitySignals(executable)
    );
  });

  it("keeps executable code around escaped strings and comment markers", () => {
    const executable = [
      "def f(value):",
      "    label = None",
      "    if value:",
      "        return value",
      "",
    ].join("\n");
    const withString = [
      "def f(value):",
      '    label = "if # else \\"for\\""',
      "    if value:",
      "        return value",
      "",
    ].join("\n");

    expect(computeComplexitySignals(withString)).toEqual(
      computeComplexitySignals(executable)
    );
  });
});

describe("computeTestProximityScore", () => {
  it("returns 100 when file is test file", () => {
    const score = computeTestProximityScore("tests/test_foo.py", new Set(["tests/test_foo.py"]));
    expect(score).toBe(100);
  });

  it("returns 80 for mirrored test in tests/", () => {
    const testFiles = new Set(["tests/test_models.py"]);
    const score = computeTestProximityScore("models.py", testFiles);
    expect(score).toBe(80);
  });

  it("returns 0 when no nearby tests", () => {
    const score = computeTestProximityScore("lib/helper.py", new Set(["tests/test_other.py"]));
    expect(score).toBe(0);
  });

  it.each([
    {
      relationship: "exact colocated test",
      testFile: "pkg/test_service.py",
      expectedScore: 100,
    },
    {
      relationship: "exact __tests__ test",
      testFile: "pkg/__tests__/test_service.py",
      expectedScore: 90,
    },
    {
      relationship: "exact mirrored tests/ test",
      testFile: "tests/pkg/service.py",
      expectedScore: 80,
    },
    {
      relationship: "unrelated colocated test",
      testFile: "pkg/test_other.py",
      expectedScore: 0,
    },
    {
      relationship: "unrelated __tests__ test",
      testFile: "pkg/__tests__/test_other.py",
      expectedScore: 0,
    },
  ])("scores $expectedScore for an $relationship", ({ testFile, expectedScore }) => {
    expect(computeTestProximityScore("pkg/service.py", new Set([testFile]))).toBe(expectedScore);
  });

  it("detects supported Python test filenames", () => {
    expect(detectTestFiles(["pkg/test_one.py", "pkg/two_test.py", "pkg/code.py"])).toEqual(
      new Set(["pkg/test_one.py", "pkg/two_test.py"])
    );
  });
});

describe("buildReducedArchitecture", () => {
  it("caps large graphs while keeping deterministic warnings and order", () => {
    const files = Array.from({ length: 55 }, (_, index) => `folder-${index}/file.py`);
    const imports = new Map<string, Set<string>>();
    for (let from = 0; from < files.length; from += 1) {
      imports.set(
        files[from],
        new Set(files.filter((_, to) => to !== from))
      );
    }
    const result = buildReducedArchitecture(files, imports);
    expect(result.architecture.nodes).toHaveLength(50);
    expect(result.architecture.edges).toHaveLength(200);
    expect(result.warnings).toEqual([
      "Architecture nodes capped at 50 folders (from 55).",
      "Architecture reduced from file-level (55 files) to folder-level (50 folders).",
      "Architecture edges capped at 200 links (from 2450).",
    ]);
  });
});

describe("Python pack boundaries", () => {
  it("keeps every production module at or below 350 lines", () => {
    const modulePaths = [
      path.join(__dirname, "python.ts"),
      ...fs
        .readdirSync(path.join(__dirname, "python"))
        .filter((file) => file.endsWith(".ts"))
        .map((file) => path.join(__dirname, "python", file)),
    ];
    for (const modulePath of modulePaths) {
      const lineCount = fs.readFileSync(modulePath, "utf-8").split(/\r?\n/).length;
      expect(lineCount, path.relative(__dirname, modulePath)).toBeLessThanOrEqual(350);
    }
  });
});

describe("runPythonPack", () => {
  it("returns empty deterministic maps when the repository has no Python files", () => {
    const result = runPythonPack("/missing", buildPipeline(["README.md"]));
    expect(result.architecture).toEqual({ nodes: [], edges: [] });
    expect(result.imports.size).toBe(0);
    expect(result.warnings).toEqual([]);
  });

  it("keeps unreadable indexed files in the result with zeroed signals", () => {
    const workspace = writeWorkspace({});
    try {
      const result = runPythonPack(workspace, buildPipeline(["missing.py"]));
      expect(result.imports.get("missing.py")).toEqual(new Set());
      expect(result.fanOut.get("missing.py")).toBe(0);
      expect(result.complexity.get("missing.py")).toBe(0);
    } finally {
      fs.rmSync(workspace, { recursive: true, force: true });
    }
  });
  it("builds import graph and fan-in/fan-out", () => {
    const workspace = writeWorkspace({
      "myapp/__init__.py": "",
      "myapp/utils.py": "def x(): pass",
      "myapp/cli.py": "from myapp.utils import x",
    });
    const pipeline = buildPipeline([
      "myapp/__init__.py",
      "myapp/utils.py",
      "myapp/cli.py",
    ]);
    try {
      const result = runPythonPack(workspace, pipeline);
      expect(result.imports.get("myapp/cli.py")).toContain("myapp/utils.py");
      expect(result.fanOut.get("myapp/cli.py")).toBe(1);
      expect(result.fanIn.get("myapp/utils.py")).toBe(1);
    } finally {
      fs.rmSync(workspace, { recursive: true, force: true });
    }
  });

  it("detects entrypoints (main.py, __main__.py)", () => {
    const workspace = writeWorkspace({
      "main.py": "print(1)",
      "pkg/__main__.py": "print(2)",
    });
    const pipeline = buildPipeline(["main.py", "pkg/__main__.py"]);
    try {
      const result = runPythonPack(workspace, pipeline);
      expect(result.entrypoints.size).toBeGreaterThanOrEqual(1);
      expect(result.entrypoints.has("main.py") || result.entrypoints.has("pkg/__main__.py")).toBe(
        true
      );
    } finally {
      fs.rmSync(workspace, { recursive: true, force: true });
    }
  });

  it("computes complexity and test proximity", () => {
    const workspace = writeWorkspace({
      "foo.py": "def f():\n    if 1:\n        pass",
      "test_foo.py": "def test_f(): pass",
    });
    const pipeline = buildPipeline(["foo.py", "test_foo.py"]);
    try {
      const result = runPythonPack(workspace, pipeline);
      expect(result.complexity.get("foo.py")).toBeGreaterThan(0);
      expect(result.testFiles.has("test_foo.py")).toBe(true);
      expect(result.testProximity!.get("foo.py")).toBe(100);
    } finally {
      fs.rmSync(workspace, { recursive: true, force: true });
    }
  });

  it("builds reduced architecture with nodes and edges", () => {
    const workspace = writeWorkspace({
      "a/one.py": "from b.two import x",
      "b/__init__.py": "",
      "b/two.py": "x = 1",
    });
    const pipeline = buildPipeline(["a/one.py", "b/__init__.py", "b/two.py"]);
    try {
      const result = runPythonPack(workspace, pipeline);
      expect(result.architecture.nodes.length).toBeGreaterThan(0);
      expect(result.architecture.edges.length).toBeGreaterThan(0);
    } finally {
      fs.rmSync(workspace, { recursive: true, force: true });
    }
  });
});
