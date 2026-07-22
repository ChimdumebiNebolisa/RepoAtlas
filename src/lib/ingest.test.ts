import { describe, it, expect } from "vitest";
import { normalizeIngestInput, validateGithubUrl } from "./ingest";

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

describe("normalizeIngestInput", () => {
  it("normalizes explicit and inferred GitHub inputs", () => {
    expect(
      normalizeIngestInput({
        kind: "github",
        githubUrl: "https://github.com/octocat/demo",
        ref: "release/v1",
      })
    ).toEqual({
      kind: "github",
      githubUrl: "https://github.com/octocat/demo",
      ref: "release/v1",
    });
    expect(
      normalizeIngestInput({ githubUrl: "https://github.com/octocat/demo" })
    ).toEqual({
      kind: "github",
      githubUrl: "https://github.com/octocat/demo",
      ref: undefined,
    });
  });

  it("normalizes ZIP inputs and preserves the display name", () => {
    expect(
      normalizeIngestInput({ kind: "zip", zipRef: "/tmp/demo.zip", zipName: "Demo.zip" })
    ).toEqual({ kind: "zip", zipRef: "/tmp/demo.zip", zipName: "Demo.zip" });
  });

  it("rejects missing input details with the stable product error", () => {
    expect(() => normalizeIngestInput({ kind: "github" })).toThrowError(
      expect.objectContaining({ code: "INVALID_INPUT", status: 400 })
    );
    expect(() => normalizeIngestInput({})).toThrowError(
      expect.objectContaining({ code: "INVALID_INPUT", status: 400 })
    );
  });
});
