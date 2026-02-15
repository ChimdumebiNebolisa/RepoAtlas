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
import type { IndexingPipelineResult } from "../pipeline";

const relKey = (...segments: string[]) => path.join(...segments);
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

  it("extracts from ... import (module spec only)", () => {
    const content = "from myapp.models import get_value\nfrom myapp import utils\n";
    const result = extractImportSpecifiers(content);
    expect(result).toContain("myapp.models");
    expect(result).toContain("myapp");
  });

  it("extracts relative imports", () => {
    const content = "from . import utils\nfrom ..pkg import mod\n";
    const result = extractImportSpecifiers(content);
    expect(result.some((s) => s.startsWith("."))).toBe(true);
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
});

describe("computeComplexitySignals", () => {
  it("counts branches and nesting", () => {
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
    expect(result.branchCount).toBeGreaterThan(2);
    expect(result.maxNesting).toBeGreaterThan(1);
    expect(result.loc).toBeGreaterThan(0);
    expect(result.score).toBeGreaterThan(0);
  });

  it("excludes comment lines from LOC", () => {
    const content = "# comment\n# another\nx = 1\n";
    const result = computeComplexitySignals(content);
    expect(result.loc).toBe(1);
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
});

describe("runPythonPack", () => {
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
