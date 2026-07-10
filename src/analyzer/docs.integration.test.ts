import { describe, expect, it } from "vitest";
import path from "path";
import { analyzeRepository } from "./index";

const dedupFixture = path.resolve(__dirname, "../../fixtures/repo-docs-dedup");
const monorepoFixture = path.resolve(__dirname, "../../fixtures/repo-monorepo");
const noReadmeFixture = path.resolve(__dirname, "../../fixtures/repo-no-readme");

describe("documentation discovery in full analysis", () => {
  it("groups duplicate docs and picks the root README as canonical", async () => {
    const { report } = await analyzeRepository({ zipRef: dedupFixture });
    const inventory = report.document_inventory;
    expect(inventory).toBeDefined();
    if (!inventory) return;

    expect(inventory.canonical_readme).toBe("README.md");

    // README.md, packages/api/README.md and docs/getting-started.md are identical.
    const group = inventory.duplicate_groups.find((g) => g.canonical === "README.md");
    expect(group).toBeDefined();
    expect(group?.duplicates).toEqual(
      expect.arrayContaining(["docs/getting-started.md", "packages/api/README.md"])
    );

    // Nested but different web README is NOT suppressed.
    const webDoc = inventory.documents.find((d) => d.path === "packages/web/README.md");
    expect(webDoc?.canonical).toBe(true);
    expect(webDoc?.duplicate_of).toBeUndefined();

    // Every document remains visible in the inventory.
    const paths = inventory.documents.map((d) => d.path);
    expect(paths).toEqual(
      expect.arrayContaining([
        "README.md",
        "docs/getting-started.md",
        "packages/api/README.md",
        "packages/web/README.md",
      ])
    );
  }, 30000);

  it("avoids repeated evidence cards for equivalent documents", async () => {
    const { report } = await analyzeRepository({ zipRef: dedupFixture });
    const docEvidencePaths = (report.candidate_brief?.evidence_refs ?? [])
      .filter((ref) => ref.kind === "doc")
      .map((ref) => ref.path);

    // The duplicated README content produces a single canonical doc card, not
    // one per equivalent copy.
    expect(docEvidencePaths).toContain("README.md");
    expect(docEvidencePaths).not.toContain("packages/api/README.md");
    // Distinct package README keeps its own card.
    expect(docEvidencePaths).toContain("packages/web/README.md");
  }, 30000);

  it("does not use a repo-name-only heading as the project purpose", async () => {
    // repo-monorepo README heading is "# Monorepo Example" style content.
    const { report } = await analyzeRepository({ zipRef: monorepoFixture });
    const purpose = report.project_purpose;
    if (purpose) {
      const repoName = report.repo_metadata.name.toLowerCase().replace(/[^a-z0-9]+/g, "");
      const purposeNorm = purpose.text.toLowerCase().replace(/[^a-z0-9]+/g, "");
      expect(purposeNorm).not.toBe(repoName);
    }
  }, 30000);

  it("handles repositories without a README", async () => {
    const { report } = await analyzeRepository({ zipRef: noReadmeFixture });
    expect(report.document_inventory).toBeDefined();
    expect(report.document_inventory?.canonical_readme).toBeUndefined();
  }, 30000);
});
