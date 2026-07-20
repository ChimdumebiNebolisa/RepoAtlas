import { afterEach, beforeEach, describe, expect, it } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import { randomUUID } from "crypto";

import type { Report } from "@/types/report";
import { createShareLink, resolveShareToken } from "@/lib/sharing";
import { listReportIds, saveReport } from "@/lib/storage";
import { GET, POST } from "./route";

const DAY_MS = 24 * 60 * 60 * 1000;
const ORIGINAL_ENV = { ...process.env };

function minimalReport(analyzedAt: string): Report {
  return {
    repo_metadata: {
      name: "retention-contract",
      url: "zip",
      branch: "main",
      clone_hash: null,
      analyzed_at: analyzedAt,
    },
    folder_map: { path: ".", type: "dir", children: [] },
    architecture: { nodes: [], edges: [] },
    start_here: [],
    danger_zones: [],
    run_commands: [],
    contribute_signals: { key_docs: [], ci_configs: [] },
    warnings: [],
  };
}

function authenticatedRequest(method: "GET" | "POST"): Request {
  return new Request("http://localhost/api/cron/cleanup", {
    method,
    headers: { authorization: "Bearer test-cron-secret" },
  });
}

describe("authenticated cleanup route contract", () => {
  let reportsDir: string;

  beforeEach(() => {
    reportsDir = fs.mkdtempSync(path.join(os.tmpdir(), "repoatlas-cleanup-route-"));
    process.env.REPORTS_DIR = reportsDir;
    process.env.REPORT_TTL_DAYS = "1";
    process.env.REPORT_MAX_COUNT = "100";
    process.env.CRON_SECRET = "test-cron-secret";
    delete process.env.BLOB_READ_WRITE_TOKEN;
    delete process.env.VERCEL_OIDC_TOKEN;
    delete process.env.BLOB_STORE_ID;
    delete process.env.VERCEL;
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
    fs.rmSync(reportsDir, { recursive: true, force: true });
  });

  it("accepts correct credentials for the health check", async () => {
    process.env.VERCEL = "1";
    const response = await GET(authenticatedRequest("GET"));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      ok: true,
      message: "POST with Authorization: Bearer CRON_SECRET to run cleanup sweep.",
    });
  });

  it("deletes expired reports and shares while retaining active records", async () => {
    const expiredReportId = randomUUID();
    const activeReportId = randomUUID();
    const sharedActiveReportId = randomUUID();
    await saveReport(
      expiredReportId,
      minimalReport(new Date(Date.now() - 3 * DAY_MS).toISOString())
    );
    await saveReport(activeReportId, minimalReport(new Date().toISOString()));
    await saveReport(sharedActiveReportId, minimalReport(new Date().toISOString()));

    const expiredShare = await createShareLink(activeReportId);
    const activeShare = await createShareLink(sharedActiveReportId);
    const sharePath = path.join(reportsDir, "shares", `${expiredShare.token}.json`);
    const shareRecord = JSON.parse(fs.readFileSync(sharePath, "utf-8")) as {
      expiresAt: string;
    };
    shareRecord.expiresAt = new Date(Date.now() - DAY_MS).toISOString();
    fs.writeFileSync(sharePath, JSON.stringify(shareRecord));

    process.env.VERCEL = "1";
    const response = await POST(authenticatedRequest("POST"));

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toMatchObject({
      reports: {
        deleted: [expiredReportId],
        retained: 2,
        scanned: 3,
        skippedBlob: false,
      },
      shares: {
        deleted: [expiredShare.token],
        scanned: 2,
      },
    });
    expect(Date.parse(body.scannedAt)).not.toBeNaN();
    expect(await listReportIds()).toEqual(
      [activeReportId, sharedActiveReportId].sort()
    );
    expect(await resolveShareToken(expiredShare.token)).toBeNull();
    expect(await resolveShareToken(activeShare.token)).toMatchObject({
      reportId: sharedActiveReportId,
    });
  });
});
