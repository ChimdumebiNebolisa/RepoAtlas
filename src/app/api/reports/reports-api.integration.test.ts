import fs from "fs";
import os from "os";
import path from "path";
import AdmZip from "adm-zip";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const fixturePath = path.resolve(process.cwd(), "fixtures/repo-ts");

describe("API integration: analyze -> report -> markdown export", () => {
  const previousReportsDir = process.env.REPORTS_DIR;
  const tempReportsDir = fs.mkdtempSync(path.join(os.tmpdir(), "repoatlas-reports-"));

  beforeAll(() => {
    process.env.REPORTS_DIR = tempReportsDir;
    vi.resetModules();
  });

  afterAll(async () => {
    if (previousReportsDir === undefined) {
      delete process.env.REPORTS_DIR;
    } else {
      process.env.REPORTS_DIR = previousReportsDir;
    }
    await fs.promises.rm(tempReportsDir, { recursive: true, force: true });
    vi.resetModules();
  });

  it("creates a report and serves report JSON + markdown export", async () => {
    const analyzeRoute = await import("@/app/api/analyze/route");
    const reportRoute = await import("@/app/api/reports/[id]/route");
    const exportRoute = await import("@/app/api/reports/[id]/export/md/route");

    // Public API accepts multipart uploads (not caller-controlled zipRef paths).
    const zip = new AdmZip();
    zip.addLocalFolder(fixturePath, "repo-ts");
    const zipBlob = new Blob([new Uint8Array(zip.toBuffer())], { type: "application/zip" });
    const form = new FormData();
    form.append("file", zipBlob, "repo-ts.zip");

    const analyzeRequest = new Request("http://localhost/api/analyze", {
      method: "POST",
      body: form,
    });

    const analyzeResponse = await analyzeRoute.POST(analyzeRequest as never);
    expect(analyzeResponse.status).toBe(200);

    const analyzePayload = (await analyzeResponse.json()) as { reportId?: string };
    expect(analyzePayload.reportId).toBeTruthy();
    const reportId = analyzePayload.reportId as string;

    const reportResponse = await reportRoute.GET(new Request("http://localhost") as never, {
      params: { id: reportId },
    });
    expect(reportResponse.status).toBe(200);

    const report = await reportResponse.json();
    expect(report.repo_metadata).toBeDefined();
    expect(report.repo_metadata.name).toContain("repo-ts");
    expect(report.folder_map).toBeDefined();
    expect(report.architecture).toBeDefined();
    expect(report.start_here).toBeInstanceOf(Array);
    expect(report.danger_zones).toBeInstanceOf(Array);
    expect(report.run_commands).toBeInstanceOf(Array);
    expect(report.contribute_signals).toBeDefined();

    const exportResponse = await exportRoute.GET(new Request("http://localhost") as never, {
      params: { id: reportId },
    });
    expect(exportResponse.status).toBe(200);
    expect(exportResponse.headers.get("content-type")).toContain("text/markdown");

    const markdown = await exportResponse.text();
    expect(markdown).toContain("# Repo Analysis:");
    expect(markdown).toContain("## Candidate Brief");
    expect(markdown).toContain("### Evidence References");
    expect(markdown).toContain("## Folder Map");
    expect(markdown).toContain("## Architecture");
    expect(markdown).toContain("## Start Here");
    expect(markdown).toContain("## Danger Zones");
    expect(markdown).toContain("## Run & Contribute");
  }, 30000);

  it("creates a report from multipart zip upload", async () => {
    const analyzeRoute = await import("@/app/api/analyze/route");
    const reportRoute = await import("@/app/api/reports/[id]/route");

    const zip = new AdmZip();
    zip.addLocalFolder(fixturePath, "repo-ts");
    const zipBlob = new Blob([new Uint8Array(zip.toBuffer())], { type: "application/zip" });
    const form = new FormData();
    form.append("file", zipBlob, "repo-ts.zip");

    const analyzeRequest = new Request("http://localhost/api/analyze", {
      method: "POST",
      body: form,
    });

    const analyzeResponse = await analyzeRoute.POST(analyzeRequest as never);
    expect(analyzeResponse.status).toBe(200);

    const analyzePayload = (await analyzeResponse.json()) as { reportId?: string };
    expect(analyzePayload.reportId).toBeTruthy();

    const reportResponse = await reportRoute.GET(new Request("http://localhost") as never, {
      params: { id: analyzePayload.reportId as string },
    });
    expect(reportResponse.status).toBe(200);

    const report = await reportResponse.json();
    expect(report.repo_metadata.name).toContain("repo-ts");
  });

  it("creates a report from the bundled sample flow", async () => {
    const analyzeRoute = await import("@/app/api/analyze/route");
    const request = new Request("http://localhost/api/analyze", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ sample: true }),
    });
    const response = await analyzeRoute.POST(request as never);
    expect(response.status).toBe(200);
    const payload = (await response.json()) as { reportId?: string };
    expect(payload.reportId).toBeTruthy();
  }, 30000);

  it("creates a report from a public GitHub URL (mocked API + archive)", async () => {
    const sha = "a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0";
    const AdmZipMod = (await import("adm-zip")).default;
    const gh = new AdmZipMod();
    gh.addFile(`demo-${sha}/README.md`, Buffer.from("# Demo\n\nMocked GitHub repo.\n"));
    gh.addFile(`demo-${sha}/index.js`, Buffer.from("module.exports = 1;\n"));
    const ghZip = gh.toBuffer();

    const originalFetch = global.fetch;
    global.fetch = (async (input: unknown) => {
      const url = typeof input === "string" ? input : String(input);
      if (url === "https://api.github.com/repos/octocat/demo") {
        return new Response(JSON.stringify({ default_branch: "main", private: false }), {
          status: 200,
        });
      }
      if (url === "https://api.github.com/repos/octocat/demo/commits/main") {
        return new Response(JSON.stringify({ sha }), { status: 200 });
      }
      if (url === `https://codeload.github.com/octocat/demo/zip/${sha}`) {
        return new Response(new Uint8Array(ghZip), { status: 200, headers: { url } });
      }
      throw new Error(`unexpected url ${url}`);
    }) as unknown as typeof global.fetch;

    try {
      const analyzeRoute = await import("@/app/api/analyze/route");
      const reportRoute = await import("@/app/api/reports/[id]/route");
      const request = new Request("http://localhost/api/analyze", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ githubUrl: "https://github.com/octocat/demo" }),
      });
      const response = await analyzeRoute.POST(request as never);
      expect(response.status).toBe(200);
      const payload = (await response.json()) as { reportId?: string };
      expect(payload.reportId).toBeTruthy();

      const reportResponse = await reportRoute.GET(new Request("http://localhost") as never, {
        params: { id: payload.reportId as string },
      });
      expect(reportResponse.status).toBe(200);
      const report = await reportResponse.json();
      expect(report.repo_metadata.name).toBe("octocat/demo");
      expect(report.repo_metadata.url).toBe("https://github.com/octocat/demo");
      expect(report.repo_metadata.clone_hash).toBe(sha);
    } finally {
      global.fetch = originalFetch;
    }
  }, 30000);

  it("rejects caller-controlled zipRef JSON with 400 (no arbitrary file access)", async () => {
    const analyzeRoute = await import("@/app/api/analyze/route");
    const request = new Request("http://localhost/api/analyze", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ zipRef: "/etc" }),
    });
    const response = await analyzeRoute.POST(request as never);
    expect(response.status).toBe(400);
    const body = (await response.json()) as { code?: string };
    expect(body.code).toBe("INVALID_INPUT");
  });

  it("rejects invalid JSON with 400 INVALID_INPUT", async () => {
    const analyzeRoute = await import("@/app/api/analyze/route");
    const request = new Request("http://localhost/api/analyze", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{not valid json",
    });
    const response = await analyzeRoute.POST(request as never);
    expect(response.status).toBe(400);
    const body = (await response.json()) as { code?: string };
    expect(body.code).toBe("INVALID_INPUT");
  });

  it("returns 404 for unknown report ID", async () => {
    const reportRoute = await import("@/app/api/reports/[id]/route");
    const response = await reportRoute.GET(new Request("http://localhost"), {
      params: { id: "11111111-1111-4111-8111-111111111111" },
    });

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      code: "NOT_FOUND",
      message: "Report not found.",
    });
  });

  it("returns 404 markdown export for unknown report ID", async () => {
    const exportRoute = await import("@/app/api/reports/[id]/export/md/route");
    const response = await exportRoute.GET(new Request("http://localhost") as never, {
      params: { id: "11111111-1111-4111-8111-111111111111" },
    });

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      code: "NOT_FOUND",
      message: "Report not found.",
    });
  });
});
