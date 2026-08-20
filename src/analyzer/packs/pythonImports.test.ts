import fs from "fs";
import os from "os";
import path from "path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { extractImportSpecifiers } from "./python/extract";
import { detectPackageRoots, resolveImport } from "./python/imports";

function writeWorkspace(files: Record<string, string>): string {
  const workspace = fs.mkdtempSync(path.join(os.tmpdir(), "repoatlas-python-imports-"));
  for (const [relativePath, content] of Object.entries(files)) {
    const fullPath = path.join(workspace, relativePath);
    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
    fs.writeFileSync(fullPath, content, "utf-8");
  }
  return workspace;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("Python import extraction boundaries", () => {
  it("ignores import-like comments and strings while preserving real imports", () => {
    const source = [
      "# import comment_only",
      "value = 'from quoted import false_edge'",
      'other = "import another_false_edge"',
      '"""',
      "from documented import false_edge",
      '"""',
      "import real_module # from trailing import false_edge",
      "from actual import useful",
      "",
    ].join("\n");

    expect(extractImportSpecifiers(source)).toEqual([
      "real_module",
      "actual",
      "actual.useful",
    ]);
  });

  it("handles CRLF, escaped continuations, aliases, and parenthesized names", () => {
    const source = [
      "import alpha, \\",
      "  beta as renamed",
      "from package \\",
      "  import (",
      "    first as one,",
      "    second,",
      "  )",
      "",
    ].join("\r\n");

    expect(extractImportSpecifiers(source)).toEqual([
      "alpha",
      "beta",
      "package",
      "package.first",
      "package.second",
    ]);
  });

  it("rejects missing-comma imports while preserving valid nearby forms", () => {
    const source = [
      "import gamma delta",
      "import alpha, beta as renamed",
      "from . import sibling",
      "message = 'import string_target'",
      "# import comment_target",
      "",
    ].join("\n");

    expect(extractImportSpecifiers(source)).toEqual(["alpha", "beta", ".sibling"]);
  });

  it("keeps nested parentheses bounded and deduplicates repeated names", () => {
    expect(
      extractImportSpecifiers(
        [
          "import ((nested), repeated), repeated",
          "from pkg import ((child), child), *",
          "",
        ].join("\n")
      )
    ).toEqual(["nested", "repeated", "pkg", "pkg.child"]);
  });

  it("handles bare relative imports and malformed or unterminated input", () => {
    expect(extractImportSpecifiers("from . import sibling\nfrom .. import parent\n")).toEqual([
      ".sibling",
      "..parent",
    ]);
    expect(extractImportSpecifiers("import\nfrom .\n'from fake import edge")).toEqual([]);
  });
});

describe("Python package-root detection boundaries", () => {
  it("continues with the repository root when the src marker cannot be inspected", () => {
    const workspace = writeWorkspace({
      "src/pkg/__init__.py": "",
    });
    const srcPath = path.join(workspace, "src");
    const statSync = fs.statSync.bind(fs);
    vi.spyOn(fs, "statSync").mockImplementation((target, options) => {
      if (target === srcPath) {
        throw Object.assign(new Error("permission denied"), { code: "EACCES" });
      }
      return statSync(target, options as never);
    });

    try {
      expect(detectPackageRoots(workspace)).toEqual([""]);
    } finally {
      fs.rmSync(workspace, { recursive: true, force: true });
    }
  });

  it("ignores unreadable manifests and non-package src directories", () => {
    const workspace = writeWorkspace({
      "pyproject.toml": "[tool.setuptools.packages.find]\nwhere = ['src']",
      "setup.py": "setup(find_packages('src'))",
      "src/README.md": "not a package",
    });
    vi.spyOn(fs, "readFileSync").mockImplementation(() => {
      throw Object.assign(new Error("permission denied"), { code: "EACCES" });
    });

    try {
      expect(detectPackageRoots(workspace)).toEqual([""]);
    } finally {
      fs.rmSync(workspace, { recursive: true, force: true });
    }
  });
});

describe("Python import resolution evidence boundaries", () => {
  it("resolves indexed relative, parent, package, and absolute modules", () => {
    const workspace = writeWorkspace({
      "src/pkg/__init__.py": "",
      "src/pkg/views.py": "",
      "src/pkg/models.py": "",
      "src/shared.py": "",
    });
    const fileSet = new Set([
      "src/pkg/__init__.py",
      "src/pkg/views.py",
      "src/pkg/models.py",
      "src/shared.py",
    ]);

    try {
      expect(resolveImport("src/pkg/views.py", ".models", workspace, ["src/"], fileSet)).toBe(
        "src/pkg/models.py"
      );
      expect(resolveImport("src/pkg/views.py", "..shared", workspace, ["src/"], fileSet)).toBe(
        "src/shared.py"
      );
      expect(resolveImport("src/pkg/views.py", ".", workspace, ["src/"], fileSet)).toBe(
        "src/pkg/__init__.py"
      );
      expect(resolveImport("src/pkg/views.py", "pkg", workspace, ["src/"], fileSet)).toBe(
        "src/pkg/__init__.py"
      );
    } finally {
      fs.rmSync(workspace, { recursive: true, force: true });
    }
  });

  it("does not create an edge to a relative module excluded from repository evidence", () => {
    const workspace = writeWorkspace({
      "pkg/source.py": "from . import generated",
      "pkg/generated.py": "generated = True",
    });
    const fileSet = new Set(["pkg/source.py"]);

    try {
      expect(resolveImport("pkg/source.py", ".generated", workspace, [""], fileSet)).toBeNull();
    } finally {
      fs.rmSync(workspace, { recursive: true, force: true });
    }
  });

  it("does not create an edge outside the indexed repository evidence", () => {
    const parent = fs.mkdtempSync(path.join(os.tmpdir(), "repoatlas-python-parent-"));
    const workspace = path.join(parent, "repo");
    fs.mkdirSync(path.join(workspace, "pkg"), { recursive: true });
    fs.writeFileSync(path.join(workspace, "pkg", "source.py"), "from ... import outside", "utf-8");
    fs.writeFileSync(path.join(parent, "outside.py"), "outside = True", "utf-8");

    try {
      expect(resolveImport("pkg/source.py", "...outside", workspace, [""], new Set([
        "pkg/source.py",
      ]))).toBeNull();
    } finally {
      fs.rmSync(parent, { recursive: true, force: true });
    }
  });

  it("returns null for empty, malformed, and unresolved modules", () => {
    const workspace = writeWorkspace({
      "pkg/source.py": "",
      "pkg/unindexed.py": "",
    });
    const fileSet = new Set(["pkg/source.py"]);

    try {
      expect(resolveImport("pkg/source.py", "", workspace, [""], fileSet)).toBeNull();
      expect(resolveImport("pkg/source.py", "missing.module", workspace, ["src/", ""], fileSet))
        .toBeNull();
      expect(resolveImport("pkg/source.py", "pkg.unindexed", workspace, [""], fileSet))
        .toBeNull();
    } finally {
      fs.rmSync(workspace, { recursive: true, force: true });
    }
  });
});
