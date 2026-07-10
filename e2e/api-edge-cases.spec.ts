import { test, expect } from "@playwright/test";
import fs from "fs";
import path from "path";
import {
  REPORTS_DIR,
  VALID_UUID,
  analyzeSample,
  minimalReport,
  writeReport,
  zipFixture,
  expireShareToken,
} from "./helpers";

test.describe("API edge cases", () => {
  test("POST /api/analyze rejects empty JSON body", async ({ request }) => {
    const res = await request.post("/api/analyze", {
      headers: { "Content-Type": "application/json" },
      data: {},
    });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.code).toBe("INVALID_INPUT");
  });

  test("POST /api/analyze rejects unsupported content type", async ({ request }) => {
    const res = await request.post("/api/analyze", {
      headers: { "Content-Type": "text/plain" },
      data: "hello",
    });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.code).toBe("INVALID_INPUT");
  });

  test("POST /api/analyze rejects corrupt zip upload", async ({ request }) => {
    const res = await request.post("/api/analyze", {
      multipart: {
        file: {
          name: "bad.zip",
          mimeType: "application/zip",
          buffer: Buffer.from("this is not a zip archive"),
        },
      },
    });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.code).toBe("ZIP_INVALID");
  });

  test("POST /api/analyze rejects caller-controlled zipRef (no arbitrary path access)", async ({ request }) => {
    const res = await request.post("/api/analyze", {
      data: { zipRef: path.join(process.cwd(), "fixtures", "does-not-exist-xyz") },
    });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.code).toBe("INVALID_INPUT");
  });

  test("POST /api/analyze rejects a non-canonical GitHub URL", async ({ request }) => {
    const res = await request.post("/api/analyze", {
      data: { githubUrl: "https://gitlab.com/foo/bar" },
    });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.code).toBe("INVALID_URL");
  });

  test("POST /api/analyze accepts docs-only fixture via zip upload", async ({ request }) => {
    const res = await request.post("/api/analyze", {
      multipart: {
        file: {
          name: "repo-docs-only.zip",
          mimeType: "application/zip",
          buffer: zipFixture("repo-docs-only"),
        },
      },
    });
    expect(res.ok()).toBe(true);
    const { reportId } = (await res.json()) as { reportId: string };
    expect(reportId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    );

    const reportRes = await request.get(`/api/reports/${reportId}`);
    expect(reportRes.ok()).toBe(true);
    const report = await reportRes.json();
    expect(report.folder_map).toBeDefined();
    expect(
      (report.warnings as string[]).some((w) => w.includes("Deep analysis unavailable"))
    ).toBe(true);
  });

  test("GET /api/reports rejects malformed id", async ({ request }) => {
    const res = await request.get("/api/reports/not-a-valid-uuid");
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.code).toBe("INVALID_INPUT");
  });

  test("GET /api/reports returns 404 for missing report", async ({ request }) => {
    const res = await request.get(`/api/reports/${VALID_UUID}`);
    expect(res.status()).toBe(404);
    const body = await res.json();
    expect(body.code).toBe("NOT_FOUND");
  });

  test("DELETE /api/reports is not exposed (public mutation removed)", async ({ request }) => {
    // The public delete mutation was intentionally removed; there is no
    // ownership model, so a guessable capability id must not destroy reports.
    const reportId = await analyzeSample(request);
    const del = await request.delete(`/api/reports/${reportId}`);
    expect(del.status()).toBe(405);
    // The report is still retrievable — it was not deleted.
    const get = await request.get(`/api/reports/${reportId}`);
    expect(get.status()).toBe(200);
  });

  test("GET /api/reports/:id sets no-store cache header", async ({ request }) => {
    const reportId = await analyzeSample(request);
    const res = await request.get(`/api/reports/${reportId}`);
    expect(res.ok()).toBe(true);
    expect(res.headers()["cache-control"]).toContain("no-store");
  });

  test("GET /api/reports/:id/export/md returns 404 for missing report", async ({ request }) => {
    const res = await request.get(`/api/reports/${VALID_UUID}/export/md`);
    expect(res.status()).toBe(404);
  });

  test("GET /api/reports/:id/export/md returns markdown for sample report", async ({
    request,
  }) => {
    const reportId = await analyzeSample(request);
    const res = await request.get(`/api/reports/${reportId}/export/md`);
    expect(res.ok()).toBe(true);
    expect(res.headers()["content-type"]).toMatch(/text\/markdown/);
    const md = await res.text();
    expect(md).toContain("# Repo Analysis");
    expect(md).toMatch(/Candidate Brief|Repo Summary/);
  });

  test("POST /api/reports/:id/share returns 404 for missing report", async ({ request }) => {
    const res = await request.post(`/api/reports/${VALID_UUID}/share`);
    expect(res.status()).toBe(404);
  });

  test("share token roundtrip via API", async ({ request }) => {
    const reportId = await analyzeSample(request);
    const create = await request.post(`/api/reports/${reportId}/share`);
    expect(create.status()).toBe(201);
    const share = await create.json();
    expect(share.sharePath).toMatch(/^\/share\//);
    expect(share.token).toBeTruthy();

    const resolve = await request.get(`/api/share/${share.token}`);
    expect(resolve.ok()).toBe(true);
    const payload = await resolve.json();
    expect(payload.report.repo_metadata.name).toContain("repo-ts");
    expect(payload.share.expiresAt).toBeTruthy();
  });

  test("GET /api/share returns 404 for expired token", async ({ request }) => {
    const reportId = await analyzeSample(request);
    const create = await request.post(`/api/reports/${reportId}/share`);
    const share = await create.json();
    expireShareToken(share.token);

    const resolve = await request.get(`/api/share/${share.token}`);
    expect(resolve.status()).toBe(404);
    const body = await resolve.json();
    expect(body.message).toMatch(/expired|not found/i);
  });

  test("GET /api/cron/cleanup returns health metadata", async ({ request }) => {
    const res = await request.get("/api/cron/cleanup");
    expect(res.ok()).toBe(true);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.message).toMatch(/cleanup sweep/i);
  });

  test("POST /api/cron/cleanup runs sweep", async ({ request }) => {
    const oldId = VALID_UUID;
    const oldDate = new Date(Date.now() - 40 * 24 * 60 * 60 * 1000).toISOString();
    writeReport(
      oldId,
      minimalReport({
        repo_metadata: {
          name: "stale-e2e",
          url: "zip",
          branch: "main",
          clone_hash: null,
          analyzed_at: oldDate,
        },
      })
    );

    const res = await request.post("/api/cron/cleanup");
    expect(res.ok()).toBe(true);
    const body = await res.json();
    expect(body.reports).toBeDefined();
    expect(Array.isArray(body.reports.deleted)).toBe(true);

    if (body.reports.deleted.includes(oldId)) {
      expect(fs.existsSync(path.join(REPORTS_DIR, `${oldId}.json`))).toBe(false);
    }
  });

  test("multipart zip upload analyzes repo-ts fixture", async ({ request }) => {
    const res = await request.post("/api/analyze", {
      multipart: {
        file: {
          name: "repo-ts.zip",
          mimeType: "application/zip",
          buffer: zipFixture("repo-ts"),
        },
      },
    });
    expect(res.ok()).toBe(true);
    const { reportId } = (await res.json()) as { reportId: string };
    const reportRes = await request.get(`/api/reports/${reportId}`);
    expect(reportRes.ok()).toBe(true);
    const report = await reportRes.json();
    expect(report.candidate_brief).toBeDefined();
    expect(report.candidate_brief.first_pr_plan).toHaveLength(3);
  });
});
