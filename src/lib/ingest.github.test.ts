import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import fs from "fs";
import AdmZip from "adm-zip";
import { ingestRepo } from "./ingest";
import { AppError } from "./errors";

const SHA = "a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0";

interface FakeInit {
  headers?: Record<string, string>;
}

function makeHeaders(init: Record<string, string> = {}): Headers {
  return new Headers(init);
}

function jsonResponse(status: number, body: unknown, headers: Record<string, string> = {}) {
  return {
    ok: status >= 200 && status < 300,
    status,
    url: "",
    headers: makeHeaders(headers),
    json: async () => body,
  };
}

function streamFrom(buf: Buffer) {
  let sent = false;
  return {
    getReader() {
      return {
        async read() {
          if (sent) return { done: true, value: undefined };
          sent = true;
          return { done: false, value: new Uint8Array(buf) };
        },
        async cancel() {
          /* no-op */
        },
      };
    },
  };
}

function archiveResponse(buf: Buffer, url: string, headers: Record<string, string> = {}) {
  return {
    ok: true,
    status: 200,
    url,
    headers: makeHeaders(headers),
    body: streamFrom(buf),
  };
}

function buildCodeloadZip(): Buffer {
  const zip = new AdmZip();
  zip.addFile(`repo-${SHA}/README.md`, Buffer.from("# Demo\n\nA demo repository."));
  zip.addFile(`repo-${SHA}/src/index.ts`, Buffer.from("export const x = 1;\n"));
  return zip.toBuffer();
}

let originalFetch: typeof global.fetch;
let capturedHeaders: Array<Record<string, string>>;
let capturedUrls: string[];

beforeEach(() => {
  originalFetch = global.fetch;
  capturedHeaders = [];
  capturedUrls = [];
  process.env.GITHUB_TOKEN = "super-secret-server-token";
});

afterEach(() => {
  global.fetch = originalFetch;
  delete process.env.GITHUB_TOKEN;
  vi.restoreAllMocks();
});

function installFetch(handler: (url: string, init?: FakeInit) => unknown) {
  global.fetch = vi.fn(async (input: unknown, init?: FakeInit) => {
    const url = typeof input === "string" ? input : String(input);
    capturedUrls.push(url);
    if (init?.headers) capturedHeaders.push(init.headers as Record<string, string>);
    return handler(url, init) as never;
  }) as unknown as typeof global.fetch;
}

describe("ingestFromGithub (mocked)", () => {
  it("resolves SHA before download, records it, and never sends the server token", async () => {
    const zip = buildCodeloadZip();
    installFetch((url) => {
      if (url === "https://api.github.com/repos/octocat/demo") {
        return jsonResponse(200, { default_branch: "main", private: false });
      }
      if (url === "https://api.github.com/repos/octocat/demo/commits/main") {
        return jsonResponse(200, { sha: SHA });
      }
      if (url === `https://codeload.github.com/octocat/demo/zip/${SHA}`) {
        return archiveResponse(zip, url);
      }
      throw new Error(`unexpected url ${url}`);
    });

    const result = await ingestRepo({
      kind: "github",
      githubUrl: "https://github.com/octocat/demo",
    });

    try {
      expect(result.cloneHash).toBe(SHA);
      expect(result.branch).toBe("main");
      expect(result.name).toBe("octocat/demo");
      expect(result.url).toBe("https://github.com/octocat/demo");
      expect(fs.existsSync(result.path)).toBe(true);
      expect(fs.existsSync(`${result.path}/README.md`)).toBe(true);
      expect(capturedUrls).toEqual([
        "https://api.github.com/repos/octocat/demo",
        "https://api.github.com/repos/octocat/demo/commits/main",
        `https://codeload.github.com/octocat/demo/zip/${SHA}`,
      ]);

      // No Authorization header on ANY request, even with GITHUB_TOKEN set.
      for (const headers of capturedHeaders) {
        const keys = Object.keys(headers).map((k) => k.toLowerCase());
        expect(keys).not.toContain("authorization");
      }
    } finally {
      await result.cleanup?.();
    }
    expect(fs.existsSync(result.path)).toBe(false);
  });

  it("maps 404 on repo metadata to REPO_NOT_FOUND (private or missing)", async () => {
    installFetch((url) => {
      if (url === "https://api.github.com/repos/octocat/secret") {
        return jsonResponse(404, { message: "Not Found" });
      }
      throw new Error(`unexpected url ${url}`);
    });

    await expect(
      ingestRepo({ kind: "github", githubUrl: "https://github.com/octocat/secret" })
    ).rejects.toMatchObject({ code: "REPO_NOT_FOUND", status: 404 });
  });

  it("maps rate-limit (403 + remaining 0) to RATE_LIMITED", async () => {
    installFetch((url) => {
      if (url === "https://api.github.com/repos/octocat/demo") {
        return jsonResponse(403, { message: "rate limit" }, { "x-ratelimit-remaining": "0" });
      }
      throw new Error(`unexpected url ${url}`);
    });

    await expect(
      ingestRepo({ kind: "github", githubUrl: "https://github.com/octocat/demo" })
    ).rejects.toMatchObject({ code: "RATE_LIMITED", status: 429 });
  });

  it("maps a missing ref to MISSING_REF", async () => {
    installFetch((url) => {
      if (url === "https://api.github.com/repos/octocat/demo") {
        return jsonResponse(200, { default_branch: "main", private: false });
      }
      if (url.includes("/commits/")) {
        return jsonResponse(404, { message: "No commit found" });
      }
      throw new Error(`unexpected url ${url}`);
    });

    await expect(
      ingestRepo({ kind: "github", githubUrl: "https://github.com/octocat/demo", ref: "nope" })
    ).rejects.toMatchObject({ code: "MISSING_REF" });
  });

  it("rejects an oversized archive via content-length", async () => {
    installFetch((url) => {
      if (url === "https://api.github.com/repos/octocat/demo") {
        return jsonResponse(200, { default_branch: "main", private: false });
      }
      if (url.includes("/commits/")) {
        return jsonResponse(200, { sha: SHA });
      }
      if (url.includes("codeload")) {
        return archiveResponse(Buffer.from("x"), url, {
          "content-length": String(200 * 1024 * 1024),
        });
      }
      throw new Error(`unexpected url ${url}`);
    });

    await expect(
      ingestRepo({ kind: "github", githubUrl: "https://github.com/octocat/demo" })
    ).rejects.toMatchObject({ code: "REPO_TOO_LARGE", status: 413 });
  });

  it("refuses a repository the API reports as private (public boundary)", async () => {
    let downloadAttempted = false;
    installFetch((url) => {
      if (url === "https://api.github.com/repos/octocat/demo") {
        return jsonResponse(200, { default_branch: "main", private: true });
      }
      if (url.includes("codeload")) {
        downloadAttempted = true;
        return archiveResponse(Buffer.from("x"), url);
      }
      throw new Error(`unexpected url ${url}`);
    });

    await expect(
      ingestRepo({ kind: "github", githubUrl: "https://github.com/octocat/demo" })
    ).rejects.toMatchObject({ code: "REPO_PRIVATE", status: 403 });
    expect(downloadAttempted).toBe(false);
  });

  it("rejects an archive redirect to a non-GitHub host (redirect policy)", async () => {
    installFetch((url) => {
      if (url === "https://api.github.com/repos/octocat/demo") {
        return jsonResponse(200, { default_branch: "main", private: false });
      }
      if (url.includes("/commits/")) {
        return jsonResponse(200, { sha: SHA });
      }
      if (url.includes("codeload")) {
        // Simulate a redirect whose final resolved URL is an attacker host.
        return archiveResponse(buildCodeloadZip(), "https://evil.example.com/archive.zip");
      }
      throw new Error(`unexpected url ${url}`);
    });

    await expect(
      ingestRepo({ kind: "github", githubUrl: "https://github.com/octocat/demo" })
    ).rejects.toMatchObject({ code: "CLONE_FAILED" });
  });

  it("rejects a non-canonical URL with INVALID_URL", async () => {
    installFetch(() => {
      throw new Error("network should not be called");
    });
    await expect(
      ingestRepo({ kind: "github", githubUrl: "https://github.com/octocat/demo/tree/main" })
    ).rejects.toMatchObject({ code: "INVALID_URL", status: 400 });
  });

  it("cleans up the temp dir when extraction fails", async () => {
    installFetch((url) => {
      if (url === "https://api.github.com/repos/octocat/demo") {
        return jsonResponse(200, { default_branch: "main", private: false });
      }
      if (url.includes("/commits/")) {
        return jsonResponse(200, { sha: SHA });
      }
      if (url.includes("codeload")) {
        return archiveResponse(Buffer.from("this is not a zip"), url);
      }
      throw new Error(`unexpected url ${url}`);
    });

    await expect(
      ingestRepo({ kind: "github", githubUrl: "https://github.com/octocat/demo" })
    ).rejects.toBeInstanceOf(AppError);
  });
});
