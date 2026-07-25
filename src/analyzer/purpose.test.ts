import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import { extractProjectPurpose } from "./purpose";

let root: string;
let outsidePaths: string[];

function write(rel: string, contents: string): void {
  const full = path.join(root, rel);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, contents);
}

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), "purpose-test-"));
  outsidePaths = [];
});

afterEach(() => {
  vi.restoreAllMocks();
  fs.rmSync(root, { recursive: true, force: true });
  for (const outsidePath of outsidePaths) {
    fs.rmSync(outsidePath, { recursive: true, force: true });
  }
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

  it.each(["parent traversal", "absolute path", "Windows parent traversal"])(
    "rejects an unsafe canonical README using %s",
    (kind) => {
      const outside = `${root}-outside.md`;
      outsidePaths.push(outside);
      fs.writeFileSync(outside, "# Unsupported outside purpose\n");
      const canonicalReadme =
        kind === "absolute path"
          ? outside
          : kind === "Windows parent traversal"
            ? String.raw`..\${path.basename(outside)}`
            : `../${path.basename(outside)}`;

      write("README.md", "# Safe repository purpose\n");

      const purpose = extractProjectPurpose(root, ["README.md"], {
        canonicalReadme,
      });

      expect(purpose?.path).toBe("README.md");
      expect(purpose?.text).toBe("Safe repository purpose");
    }
  );

  it("does not follow a canonical README symlink outside the repository", () => {
    const outside = `${root}-outside.md`;
    outsidePaths.push(outside);
    fs.writeFileSync(outside, "# Unsupported outside purpose\n");
    fs.symlinkSync(outside, path.join(root, "README.md"));
    write(
      "package.json",
      JSON.stringify({ description: "Repository package purpose" })
    );

    const purpose = extractProjectPurpose(root, ["README.md"], {
      canonicalReadme: "README.md",
    });

    expect(purpose?.source).toBe("package.json");
    expect(purpose?.text).toBe("Repository package purpose");
  });

  it("continues past an unreadable canonical README", () => {
    write("README.md", "# Unreadable purpose\n");
    write(
      "package.json",
      JSON.stringify({ description: "Readable package purpose" })
    );
    const readFileSync = fs.readFileSync;
    vi.spyOn(fs, "readFileSync").mockImplementation((file, ...args) => {
      if (path.resolve(String(file)) === path.join(root, "README.md")) {
        throw new Error("read failed");
      }
      return readFileSync(file, ...args);
    });

    expect(extractProjectPurpose(root, ["README.md"])).toMatchObject({
      source: "package.json",
      text: "Readable package purpose",
    });
  });

  it("continues from a blank canonical README to the next safe README", () => {
    write("README.md", " \n");
    write("docs/README.md", "# Documented repository purpose\n");
    write(
      "package.json",
      JSON.stringify({ description: "Package purpose should be later" })
    );

    const purpose = extractProjectPurpose(
      root,
      ["README.md", "docs/README.md"],
      { canonicalReadme: "README.md" }
    );

    expect(purpose?.path).toBe("docs/README.md");
    expect(purpose?.text).toBe("Documented repository purpose");
  });

  it("does not promote a repository-name-only README when metadata is stronger", () => {
    write("README.md", "# RepoAtlas\n");
    write(
      "package.json",
      JSON.stringify({ description: "A deterministic repository analyzer" })
    );

    expect(
      extractProjectPurpose(root, ["README.md"], { repoName: "RepoAtlas" })
    ).toMatchObject({
      source: "package.json",
      text: "A deterministic repository analyzer",
    });
  });

  it("ignores malformed and blank package descriptions", () => {
    write("package.json", '{"description":');
    write(
      "pyproject.toml",
      '[project]\ndescription = "A Python repository analyzer"\n'
    );

    expect(extractProjectPurpose(root, [])).toMatchObject({
      source: "pyproject",
      text: "A Python repository analyzer",
    });

    write("package.json", JSON.stringify({ description: "   " }));
    expect(extractProjectPurpose(root, [])).toMatchObject({
      source: "pyproject",
      text: "A Python repository analyzer",
    });
  });

  it("does not follow package metadata symlinks outside the repository", () => {
    const outside = `${root}-outside-package.json`;
    outsidePaths.push(outside);
    fs.writeFileSync(
      outside,
      JSON.stringify({ description: "Unsupported outside package purpose" })
    );
    fs.symlinkSync(outside, path.join(root, "package.json"));
    write(
      "pyproject.toml",
      '[project]\ndescription = "Repository Python purpose"\n'
    );

    expect(extractProjectPurpose(root, [])).toMatchObject({
      source: "pyproject",
      text: "Repository Python purpose",
    });
  });

  it("supports single-quoted PEP 621 descriptions", () => {
    write(
      "pyproject.toml",
      "[project]\ndescription = 'A single-quoted Python purpose'\n"
    );

    expect(extractProjectPurpose(root, [])).toMatchObject({
      source: "pyproject",
      text: "A single-quoted Python purpose",
    });
  });

  it("supports Poetry descriptions when PEP 621 metadata is absent", () => {
    write(
      "pyproject.toml",
      '[tool.poetry]\nname = "example"\ndescription = "A Poetry repository purpose"\n'
    );

    expect(extractProjectPurpose(root, [])).toMatchObject({
      source: "pyproject",
      text: "A Poetry repository purpose",
    });
  });

  it("prefers PEP 621 over Poetry descriptions regardless of file order", () => {
    write(
      "pyproject.toml",
      [
        "[tool.poetry]",
        'description = "Poetry fallback purpose"',
        "[project]",
        'description = "Canonical Python purpose"',
      ].join("\n")
    );

    expect(extractProjectPurpose(root, [])).toMatchObject({
      source: "pyproject",
      text: "Canonical Python purpose",
    });
  });

  it.each([
    ["a blank description", '[project]\ndescription = "   "\n'],
    ["an unrelated description", '[tool.example]\ndescription = "Wrong"\n'],
    ["malformed quoting", '[project]\ndescription = "unterminated\n'],
  ])("ignores %s in Python metadata", (_label, contents) => {
    write("pyproject.toml", contents);
    expect(extractProjectPurpose(root, [])).toBeUndefined();
  });

  it("continues safely when Python metadata cannot be read", () => {
    write(
      "pyproject.toml",
      '[project]\ndescription = "Unreadable Python purpose"\n'
    );
    const readFileSync = fs.readFileSync;
    vi.spyOn(fs, "readFileSync").mockImplementation((file, ...args) => {
      if (path.resolve(String(file)) === path.join(root, "pyproject.toml")) {
        throw new Error("read failed");
      }
      return readFileSync(file, ...args);
    });

    expect(extractProjectPurpose(root, [])).toBeUndefined();
  });

  it("does not follow Python metadata symlinks outside the repository", () => {
    const outside = `${root}-outside-pyproject.toml`;
    outsidePaths.push(outside);
    fs.writeFileSync(
      outside,
      '[project]\ndescription = "Unsupported outside Python purpose"\n'
    );
    fs.symlinkSync(outside, path.join(root, "pyproject.toml"));

    expect(extractProjectPurpose(root, [])).toBeUndefined();
  });

  it("returns undefined when nothing meaningful exists", () => {
    write("src/index.ts", "export const x = 1;\n");
    expect(extractProjectPurpose(root, [])).toBeUndefined();
  });
});
