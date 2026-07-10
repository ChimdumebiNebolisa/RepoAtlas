import { afterEach, beforeEach, describe, expect, it } from "vitest";
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
});
