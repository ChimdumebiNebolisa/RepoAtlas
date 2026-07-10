import { describe, it, expect } from "vitest";
import { parseGithubRepoUrl, isValidGitRef } from "./github";

describe("parseGithubRepoUrl", () => {
  it("accepts canonical https repo URLs", () => {
    expect(parseGithubRepoUrl("https://github.com/vercel/next.js")).toEqual({
      owner: "vercel",
      repo: "next.js",
    });
  });

  it("accepts trailing .git", () => {
    expect(parseGithubRepoUrl("https://github.com/owner/repo.git")).toEqual({
      owner: "owner",
      repo: "repo",
    });
  });

  it("tolerates a single trailing slash", () => {
    expect(parseGithubRepoUrl("https://github.com/owner/repo/")).toEqual({
      owner: "owner",
      repo: "repo",
    });
  });

  it("rejects tree/blob/subpath URLs", () => {
    expect(parseGithubRepoUrl("https://github.com/owner/repo/tree/main")).toBeNull();
    expect(parseGithubRepoUrl("https://github.com/owner/repo/blob/main/x.ts")).toBeNull();
  });

  it("rejects non-https and non-github hosts", () => {
    expect(parseGithubRepoUrl("http://github.com/owner/repo")).toBeNull();
    expect(parseGithubRepoUrl("https://gitlab.com/owner/repo")).toBeNull();
    expect(parseGithubRepoUrl("https://www.github.com/owner/repo")).toBeNull();
    expect(parseGithubRepoUrl("https://raw.githubusercontent.com/o/r/main/x")).toBeNull();
  });

  it("rejects query strings, fragments, ports and credentials", () => {
    expect(parseGithubRepoUrl("https://github.com/owner/repo?x=1")).toBeNull();
    expect(parseGithubRepoUrl("https://github.com/owner/repo#readme")).toBeNull();
    expect(parseGithubRepoUrl("https://github.com:8443/owner/repo")).toBeNull();
    expect(parseGithubRepoUrl("https://user:pass@github.com/owner/repo")).toBeNull();
  });

  it("rejects malformed and empty input", () => {
    expect(parseGithubRepoUrl("not a url")).toBeNull();
    expect(parseGithubRepoUrl("")).toBeNull();
    expect(parseGithubRepoUrl("https://github.com/owner")).toBeNull();
    expect(parseGithubRepoUrl("https://github.com/")).toBeNull();
  });
});

describe("isValidGitRef", () => {
  it("accepts normal branch and tag names", () => {
    expect(isValidGitRef("main")).toBe(true);
    expect(isValidGitRef("feature/new-thing")).toBe(true);
    expect(isValidGitRef("v1.2.3")).toBe(true);
    expect(isValidGitRef("release-2026")).toBe(true);
  });

  it("rejects unsafe refs", () => {
    expect(isValidGitRef("")).toBe(false);
    expect(isValidGitRef("../etc")).toBe(false);
    expect(isValidGitRef("-bad")).toBe(false);
    expect(isValidGitRef("/leading")).toBe(false);
    expect(isValidGitRef("trailing/")).toBe(false);
    expect(isValidGitRef("has space")).toBe(false);
    expect(isValidGitRef("weird@{upstream}")).toBe(false);
    expect(isValidGitRef("double//slash")).toBe(false);
    expect(isValidGitRef("ends.lock")).toBe(false);
  });
});
