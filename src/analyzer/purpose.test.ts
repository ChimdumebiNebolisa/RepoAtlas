import { afterEach, beforeEach, describe, expect, it } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import { extractProjectPurpose } from "./purpose";

let root: string;

function write(rel: string, contents: string): void {
  const full = path.join(root, rel);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, contents);
}

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), "purpose-test-"));
});

afterEach(() => {
  fs.rmSync(root, { recursive: true, force: true });
});

describe("extractProjectPurpose", () => {
  it("uses a meaningful README heading", () => {
    write("README.md", "# A deterministic repo analyzer\n\nBody here.\n");
    const purpose = extractProjectPurpose(root, ["README.md"]);
    expect(purpose?.source).toBe("readme_heading");
    expect(purpose?.text).toBe("A deterministic repo analyzer");
    expect(purpose?.path).toBe("README.md");
  });

  it("rejects a heading that is only the repo name and prefers the intro paragraph", () => {
    write(
      "README.md",
      "# RepoAtlas\n\nRepoAtlas turns any repository into an interview-ready brief.\n"
    );
    const purpose = extractProjectPurpose(root, ["README.md"], {
      repoName: "RepoAtlas",
    });
    expect(purpose?.source).toBe("readme_intro");
    expect(purpose?.text).toContain("interview-ready brief");
  });

  it("treats owner/name repo names by comparing the tail segment", () => {
    write(
      "README.md",
      "# repo-atlas\n\nA tool that maps repositories into onboarding guides.\n"
    );
    const purpose = extractProjectPurpose(root, ["README.md"], {
      repoName: "ChimdumebiNebolisa/repo-atlas",
    });
    expect(purpose?.source).toBe("readme_intro");
  });

  it("prefers the canonical README over an arbitrary keyDoc match", () => {
    write("packages/api/README.md", "# Nested API\n\nNested content.\n");
    write("README.md", "# Root purpose here\n\nRoot content.\n");
    const purpose = extractProjectPurpose(
      root,
      ["packages/api/README.md", "README.md"],
      { canonicalReadme: "README.md" }
    );
    expect(purpose?.path).toBe("README.md");
    expect(purpose?.text).toBe("Root purpose here");
  });

  it("falls back to package.json description when no README is present", () => {
    write("package.json", JSON.stringify({ description: "A CLI for widgets" }));
    const purpose = extractProjectPurpose(root, []);
    expect(purpose?.source).toBe("package.json");
    expect(purpose?.text).toBe("A CLI for widgets");
  });

  it("returns undefined when nothing meaningful exists", () => {
    write("src/index.ts", "export const x = 1;\n");
    expect(extractProjectPurpose(root, [])).toBeUndefined();
  });
});
