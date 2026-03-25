import fs from "fs";
import os from "os";
import path from "path";
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

    const analyzeRequest = new Request("http://localhost/api/analyze", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ zipRef: fixturePath }),
    });

    const analyzeResponse = await analyzeRoute.POST(analyzeRequest as never);
    expect(analyzeResponse.status).toBe(200);

    const analyzePayload = (await analyzeResponse.json()) as { reportId?: string };
    expect(analyzePayload.reportId).toBeTruthy();
    const reportId = analyzePayload.reportId as string;

    const reportResponse = await reportRoute.GET(new Request("http://localhost"), {
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

    const exportResponse = await exportRoute.GET(new Request("http://localhost"), {
      params: { id: reportId },
    });
    expect(exportResponse.status).toBe(200);
    expect(exportResponse.headers.get("content-type")).toContain("text/markdown");

    const markdown = await exportResponse.text();
    expect(markdown).toContain("# Repo Brief:");
    expect(markdown).toContain("## Folder Map");
    expect(markdown).toContain("## Architecture");
    expect(markdown).toContain("## Start Here");
    expect(markdown).toContain("## Danger Zones");
    expect(markdown).toContain("## Run & Contribute");
  }, 30000);

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
    const response = await exportRoute.GET(new Request("http://localhost"), {
      params: { id: "11111111-1111-4111-8111-111111111111" },
    });

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      code: "NOT_FOUND",
      message: "Report not found.",
    });
  });
});
