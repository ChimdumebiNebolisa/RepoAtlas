import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import {
  canonicalizeKeyDocs,
  discoverDocuments,
  normalizeDocContent,
} from "./docs";

let root: string;

function write(rel: string, contents: string): void {
  const full = path.join(root, rel);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, contents);
}

function discover() {
  const files: string[] = [];
  const walk = (dir: string, base: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const abs = path.join(dir, entry.name);
      const rel = base ? `${base}/${entry.name}` : entry.name;
      if (entry.isDirectory()) walk(abs, rel);
      else files.push(rel);
    }
  };
  walk(root, "");
  // Intentionally shuffle to prove ordering is deterministic regardless of input order.
  files.reverse();
  return discoverDocuments(root, files);
}

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), "docs-test-"));
});

afterEach(() => {
  vi.restoreAllMocks();
  fs.rmSync(root, { recursive: true, force: true });
});

describe("normalizeDocContent", () => {
  it("strips BOM, normalizes CRLF, trailing and surrounding whitespace", () => {
    const a = "\uFEFF# Title\r\nHello   \r\n\r\n";
    const b = "\n# Title\nHello\n";
    expect(normalizeDocContent(a)).toBe(normalizeDocContent(b));
    expect(normalizeDocContent(a)).toBe("# Title\nHello");
  });
});

describe("discoverDocuments", () => {
  it("prefers root README as canonical over nested duplicates and sorts deterministically", () => {
    const body = "# Project\n\nA meaningful description of the tool.\n";
    write("README.md", body);
    write("packages/api/README.md", body); // byte-identical nested duplicate
    const inv = discoverDocuments(root, [
      "packages/api/README.md",
      "README.md",
    ]);

    // Root README wins.
    expect(inv.canonical_readme).toBe("README.md");
    const canonical = inv.documents.filter((d) => d.canonical).map((d) => d.path);
    expect(canonical).toContain("README.md");
    expect(canonical).not.toContain("packages/api/README.md");

    // Grouped as identical, nested marked as duplicate_of root.
    expect(inv.duplicate_groups).toHaveLength(1);
    expect(inv.duplicate_groups[0]).toMatchObject({
      canonical: "README.md",
      duplicates: ["packages/api/README.md"],
      reason: "identical",
    });
    const nested = inv.documents.find((d) => d.path === "packages/api/README.md");
    expect(nested?.duplicate_of).toBe("README.md");

    // Deterministic order: root first.
    expect(inv.documents[0].path).toBe("README.md");
  });

  it("detects whitespace-only (normalized) duplicates", () => {
    write("README.md", "# Title\n\nContent line one.\n");
    write("docs/copy.md", "\uFEFF# Title\r\n\r\nContent line one.   \r\n\r\n");
    const inv = discoverDocuments(root, ["README.md", "docs/copy.md"]);

    expect(inv.duplicate_groups).toHaveLength(1);
    expect(inv.duplicate_groups[0].reason).toBe("normalized-identical");
    expect(inv.duplicate_groups[0].canonical).toBe("README.md");
  });

  it("rejects unsafe candidate paths and symlinks outside the repository", () => {
    const outsideRoot = fs.mkdtempSync(path.join(os.tmpdir(), "docs-outside-"));
    const outsideReadme = path.join(outsideRoot, "README.md");
    fs.writeFileSync(outsideReadme, "# Outside\n\nThis must not become repository evidence.\n");
    write("README.md", "# Inside\n\nRepository documentation.\n");
    fs.mkdirSync(path.join(root, "packages/link"), { recursive: true });
    fs.symlinkSync(outsideReadme, path.join(root, "packages/link/README.md"));

    const inv = discoverDocuments(root, [
      path.relative(root, outsideReadme),
      "/tmp/README.md",
      "C:\\temp\\README.md",
      "docs/../README.md",
      "packages/link/README.md",
      "README.md",
    ]);

    expect(inv.documents.map((document) => document.path)).toEqual(["README.md"]);
    fs.rmSync(outsideRoot, { recursive: true, force: true });
  });

  it("skips unreadable, empty, and unsupported document candidates", () => {
    write("README.md", "# Project\n\nUsable documentation.\n");
    write("docs/empty.md", " \n\t\r\n");
    write("README.exe", "not documentation");
    write("CONTRIBUTING.json", "{}");
    write("docs/image.png", "not documentation");
    write("docs/unreadable.md", "# Hidden");
    const readFileSync = fs.readFileSync.bind(fs);
    vi.spyOn(fs, "readFileSync").mockImplementation((file, ...args) => {
      if (String(file).replace(/\\/g, "/").endsWith("docs/unreadable.md")) {
        throw new Error("simulated read failure");
      }
      return readFileSync(file, ...args);
    });

    const inv = discoverDocuments(root, [
      "docs/unreadable.md",
      "README.exe",
      "docs/empty.md",
      "CONTRIBUTING.json",
      "docs/image.png",
      "README.md",
    ]);

    expect(inv.documents.map((document) => document.path)).toEqual(["README.md"]);
  });

  it("rejects missing paths, directories, and non-directory parents", () => {
    expect(discoverDocuments(root, ["README.md"]).documents).toEqual([]);

    fs.mkdirSync(path.join(root, "docs/README.md"), { recursive: true });
    expect(discoverDocuments(root, ["docs/README.md"]).documents).toEqual([]);
    fs.rmSync(path.join(root, "docs"), { recursive: true, force: true });

    fs.writeFileSync(path.join(root, "docs"), "not a directory");
    expect(discoverDocuments(root, ["docs/README.md"]).documents).toEqual([]);
  });

  it("recognizes supported names, extensions, casing, categories, and scopes", () => {
    write("rEaDmE.MDX", "# Read me");
    write("CONTRIBUTING.rst", "Contributing");
    write("docs/Architecture.AdOc", "Architecture");
    write("docs/guide.TXT", "Guide");
    write("CHANGELOG.md", "Changes");
    write("COPYING", "License");

    const inv = discoverDocuments(root, [
      "docs/guide.TXT",
      "COPYING",
      "CHANGELOG.md",
      "docs/Architecture.AdOc",
      "CONTRIBUTING.rst",
      "rEaDmE.MDX",
    ]);

    expect(inv.documents.map(({ path: documentPath, category, scope }) => ({
      path: documentPath,
      category,
      scope,
    }))).toEqual([
      { path: "rEaDmE.MDX", category: "readme", scope: "root" },
      { path: "CONTRIBUTING.rst", category: "contributing", scope: "root" },
      { path: "docs/Architecture.AdOc", category: "architecture", scope: "docs" },
      { path: "docs/guide.TXT", category: "docs", scope: "docs" },
      { path: "CHANGELOG.md", category: "changelog", scope: "root" },
      { path: "COPYING", category: "license", scope: "root" },
    ]);
    expect(inv.canonical_readme).toBe("rEaDmE.MDX");
  });

  it("treats different nested package READMEs as legitimate (no duplicate group)", () => {
    write("README.md", "# Monorepo root\n\nTop level workspace.\n");
    write("packages/api/README.md", "# API package\n\nThe REST API service.\n");
    write("packages/web/README.md", "# Web package\n\nThe frontend app.\n");
    const inv = discoverDocuments(root, [
      "README.md",
      "packages/api/README.md",
      "packages/web/README.md",
    ]);

    expect(inv.duplicate_groups).toHaveLength(0);
    // All three remain visible and canonical (none suppressed).
    expect(inv.documents.filter((d) => d.canonical)).toHaveLength(3);
    expect(inv.canonical_readme).toBe("README.md");
  });

  it("flags similar-but-different documents without discarding them", () => {
    const base = Array.from({ length: 20 }, (_, i) => `Line ${i} shared content here`).join("\n");
    // Same category (docs) and shared body so the pair is near-identical but not equal.
    write("docs/a.md", `# Shared heading\n\n${base}\nalpha unique tail.\n`);
    write("docs/b.md", `# Shared heading\n\n${base}\nbeta unique tail.\n`);
    const inv = discoverDocuments(root, ["docs/a.md", "docs/b.md"]);

    // Nothing removed.
    expect(inv.documents.filter((d) => d.category === "docs")).toHaveLength(2);
    expect(inv.duplicate_groups).toHaveLength(0);
    // At least one similar pair flagged among the docs.
    expect((inv.similar_groups ?? []).length).toBeGreaterThan(0);
    for (const g of inv.similar_groups ?? []) {
      expect(g.similarity).toBeGreaterThanOrEqual(0.85);
      expect(g.similarity).toBeLessThan(1);
    }
  });

  it("keeps documents below the similarity threshold separate", () => {
    const shared = Array.from({ length: 11 }, (_, i) => `Shared line ${i}`);
    write("docs/a.md", [...shared, "Only A"].join("\n"));
    write("docs/b.md", [...shared, "Only B"].join("\n"));

    const inv = discoverDocuments(root, ["docs/a.md", "docs/b.md"]);

    expect(inv.similar_groups).toEqual([]);
    expect(inv.documents.every((document) => document.canonical)).toBe(true);
  });

  it("uses category, scope, depth, and path as deterministic canonical tie-breakers", () => {
    const body = "# Shared\n\nSame documentation.\n";
    write("packages/b/README.md", body);
    write("packages/a/README.md", body);
    write("docs/README.md", body);
    write("README.md", body);

    const candidates = [
      "packages/b/README.md",
      "packages/a/README.md",
      "docs/README.md",
      "README.md",
      "README.md",
    ];
    const forward = discoverDocuments(root, candidates);
    const reverse = discoverDocuments(root, [...candidates].reverse());

    expect(forward).toEqual(reverse);
    expect(forward.duplicate_groups).toEqual([
      {
        canonical: "README.md",
        duplicates: [
          "docs/README.md",
          "packages/a/README.md",
          "packages/b/README.md",
        ],
        reason: "identical",
      },
    ]);
  });

  it("prefers shallower equivalent paths before lexicographic order", () => {
    write("packages/z/README.md", "# Z\n\nDistinct package.\n");
    write("packages/a/nested/README.md", "# A\n\nAnother package.\n");

    const inv = discoverDocuments(root, [
      "packages/a/nested/README.md",
      "packages/z/README.md",
    ]);

    expect(inv.documents.map((document) => document.path)).toEqual([
      "packages/z/README.md",
      "packages/a/nested/README.md",
    ]);
  });

  it("labels mixed exact and normalized copies as normalized-identical", () => {
    write("README.md", "# Shared\n\nContent\n");
    write("docs/a.md", "# Shared\n\nContent\n");
    write("docs/b.md", "\uFEFF# Shared\r\n\r\nContent   \r\n");

    const inv = discoverDocuments(root, ["docs/b.md", "docs/a.md", "README.md"]);

    expect(inv.duplicate_groups).toEqual([
      {
        canonical: "README.md",
        duplicates: ["docs/a.md", "docs/b.md"],
        reason: "normalized-identical",
      },
    ]);
  });

  it("returns an empty inventory when no candidate document is usable", () => {
    expect(discoverDocuments(root, [])).toEqual({
      documents: [],
      duplicate_groups: [],
      similar_groups: [],
      canonical_readme: undefined,
    });
  });

  it("handles repositories without a README", () => {
    write("docs/guide.md", "# Guide\n\nHow to use.\n");
    const inv = discoverDocuments(root, ["docs/guide.md"]);
    expect(inv.canonical_readme).toBeUndefined();
    expect(inv.documents).toHaveLength(1);
    expect(inv.duplicate_groups).toHaveLength(0);
  });

  it("is deterministic regardless of input path order", () => {
    write("README.md", "# R\n\nRoot readme content here.\n");
    write("CONTRIBUTING.md", "# Contributing\n\nHow to contribute here.\n");
    write("docs/design.md", "# Design\n\nArchitecture notes here.\n");
    write("packages/x/README.md", "# X\n\nPackage X readme content.\n");

    const forward = discoverDocuments(root, [
      "CONTRIBUTING.md",
      "README.md",
      "docs/design.md",
      "packages/x/README.md",
    ]);
    const reversed = discoverDocuments(root, [
      "packages/x/README.md",
      "docs/design.md",
      "README.md",
      "CONTRIBUTING.md",
    ]);
    expect(forward.documents.map((d) => d.path)).toEqual(
      reversed.documents.map((d) => d.path)
    );
    // Root README ranks first.
    expect(forward.documents[0].path).toBe("README.md");
  });
});

describe("canonicalizeKeyDocs", () => {
  it("collapses duplicate paths to their canonical representative", () => {
    const body = "# Project\n\nMeaningful description.\n";
    write("README.md", body);
    write("packages/api/README.md", body);
    const inv = discoverDocuments(root, ["README.md", "packages/api/README.md"]);

    const { canonicalDocs, duplicateOf } = canonicalizeKeyDocs(
      ["README.md", "packages/api/README.md"],
      inv
    );
    expect(canonicalDocs).toEqual(["README.md"]);
    expect(duplicateOf.get("packages/api/README.md")).toBe("README.md");
  });

  it("returns docs unchanged when no inventory is provided", () => {
    const { canonicalDocs } = canonicalizeKeyDocs(["a", "b"], undefined);
    expect(canonicalDocs).toEqual(["a", "b"]);
  });

  it("preserves the first occurrence of canonical and distinct documents", () => {
    const body = "# Project\n\nMeaningful description.\n";
    write("README.md", body);
    write("packages/api/README.md", body);
    write("CONTRIBUTING.md", "# Contributing\n\nDifferent guidance.\n");
    const inv = discoverDocuments(root, [
      "README.md",
      "packages/api/README.md",
      "CONTRIBUTING.md",
    ]);

    const { canonicalDocs } = canonicalizeKeyDocs(
      [
        "packages/api/README.md",
        "README.md",
        "CONTRIBUTING.md",
        "CONTRIBUTING.md",
      ],
      inv
    );

    expect(canonicalDocs).toEqual(["README.md", "CONTRIBUTING.md"]);
  });
});
