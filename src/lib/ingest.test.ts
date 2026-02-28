import { describe, it, expect } from "vitest";
import { isRemoteBranchNotFoundMessage, validateGithubUrl } from "./ingest";

describe("validateGithubUrl", () => {
  it("accepts valid GitHub URLs", () => {
    expect(validateGithubUrl("https://github.com/vercel/next.js")).toEqual({
      owner: "vercel",
      repo: "next.js",
      ref: undefined,
    });
  });

  it("accepts URLs with tree/branch", () => {
    expect(
      validateGithubUrl("https://github.com/owner/repo/tree/main")
    ).toEqual({
      owner: "owner",
      repo: "repo",
      ref: "main",
    });
  });

  it("rejects non-GitHub URLs", () => {
    expect(validateGithubUrl("https://gitlab.com/foo/bar")).toBeNull();
    expect(validateGithubUrl("https://example.com")).toBeNull();
  });

  it("rejects malformed URLs", () => {
    expect(validateGithubUrl("not-a-url")).toBeNull();
    expect(validateGithubUrl("")).toBeNull();
  });
});

describe("isRemoteBranchNotFoundMessage", () => {
  it("detects git remote branch missing errors", () => {
    expect(
      isRemoteBranchNotFoundMessage(
        "fatal: Remote branch main not found in upstream origin"
      )
    ).toBe(true);
  });

  it("ignores unrelated clone failures", () => {
    expect(
      isRemoteBranchNotFoundMessage(
        "fatal: repository 'https://github.com/owner/private.git/' not found"
      )
    ).toBe(false);
  });
});
