import { describe, expect, it } from "vitest";

import { buildExportFilename, slugifyRepoName } from "./exportNames";

const EXPECTED_PREFIX = "repoatlas-candidate-brief-";
const UNSAFE_FILENAME_CHARACTERS = /[\/\\\u0000-\u001f\u007f]/;

describe("export filenames", () => {
  it.each([
    ["ordinary names", "RepoAtlas", "repoatlas"],
    ["punctuation-heavy names", "repo...atlas?! candidate/brief", "repo-atlas-candidate-brief"],
    ["Unicode-only names", "候補者リポジトリ", "repo"],
    ["blank names", " \t\n ", "repo"],
    ["repeated separators", "repo---___...atlas", "repo-atlas"],
    ["leading and trailing separators", "///repo atlas\\\\", "repo-atlas"],
  ])("creates a stable slug for %s", (_caseName, input, expected) => {
    expect(slugifyRepoName(input)).toBe(expected);
  });

  it("truncates long names without leaving a trailing separator", () => {
    const slug = slugifyRepoName(`${"a".repeat(59)} repository`);

    expect(slug).toBe("a".repeat(59));
    expect(slug).toHaveLength(59);
    expect(slug).not.toMatch(/-$/);
  });

  it.each([
    ["pdf", "repoatlas-candidate-brief-repo-atlas-2026-07-24.pdf"],
    ["png", "repoatlas-candidate-brief-repo-atlas-2026-07-24.png"],
    ["md", "repoatlas-candidate-brief-repo-atlas-2026-07-24.md"],
  ] as const)("uses the analyzed date for %s exports", (ext, expected) => {
    expect(
      buildExportFilename({
        repoName: "Repo Atlas",
        analyzedAt: "2026-07-24T13:32:20.000Z",
        ext,
      })
    ).toBe(expected);
  });

  it.each([
    ["invalid dates", "2026-99-99T00:00:00.000Z"],
    ["path-like dates", "../../private"],
    ["control characters", "2026-07-\n24"],
    ["blank dates", "  "],
  ])("uses a deterministic safe date for %s", (_caseName, analyzedAt) => {
    const filename = buildExportFilename({
      repoName: "../Repo\u0000Atlas",
      analyzedAt,
      ext: "pdf",
    });

    expect(filename).toBe("repoatlas-candidate-brief-repo-atlas-undated.pdf");
    expect(filename).toMatch(new RegExp(`^${EXPECTED_PREFIX}`));
    expect(filename).not.toMatch(UNSAFE_FILENAME_CHARACTERS);
  });

  it("never returns path separators or control characters", () => {
    const filename = buildExportFilename({
      repoName: "..\\nested/\u0000\u001frepo",
      analyzedAt: "2026-07-24",
      ext: "png",
    });

    expect(filename).toBe("repoatlas-candidate-brief-nested-repo-2026-07-24.png");
    expect(filename).not.toMatch(UNSAFE_FILENAME_CHARACTERS);
  });
});
