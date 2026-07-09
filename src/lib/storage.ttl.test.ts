import { describe, expect, it, beforeEach, afterEach } from "vitest";
import fs from "fs";
import path from "path";
import os from "os";
import { randomUUID } from "crypto";
import type { Report } from "@/types/report";
import {
  saveReport,
  listReportIds,
  sweepExpiredReports,
  deleteReport,
} from "@/lib/storage";

const minimalReport = (analyzedAt: string): Report => ({
  repo_metadata: {
    name: "ttl-test",
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
});

describe("report TTL sweep", () => {
  let reportsDir: string;

  beforeEach(() => {
    reportsDir = fs.mkdtempSync(path.join(os.tmpdir(), "repoatlas-ttl-"));
    process.env.REPORTS_DIR = reportsDir;
    process.env.REPORT_TTL_DAYS = "1";
    process.env.REPORT_MAX_COUNT = "2";
  });

  afterEach(() => {
    delete process.env.REPORTS_DIR;
    delete process.env.REPORT_TTL_DAYS;
    delete process.env.REPORT_MAX_COUNT;
    fs.rmSync(reportsDir, { recursive: true, force: true });
  });

  it("lists saved report ids", async () => {
    const id = randomUUID();
    await saveReport(id, minimalReport(new Date().toISOString()));
    expect(await listReportIds()).toContain(id);
  });

  it("deletes reports older than TTL", async () => {
    const oldId = randomUUID();
    const oldDate = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
    await saveReport(oldId, minimalReport(oldDate));

    const result = await sweepExpiredReports();
    expect(result.deleted).toContain(oldId);
    expect(await listReportIds()).not.toContain(oldId);
  });

  it("enforces max report count keeping newest", async () => {
    const ids = [randomUUID(), randomUUID(), randomUUID()];
    const now = Date.now();
    await saveReport(ids[0], minimalReport(new Date(now - 3000).toISOString()));
    await saveReport(ids[1], minimalReport(new Date(now - 2000).toISOString()));
    await saveReport(ids[2], minimalReport(new Date(now - 1000).toISOString()));

    const result = await sweepExpiredReports();
    expect(result.deleted).toContain(ids[0]);
    expect(await listReportIds()).toContain(ids[2]);
  });
});
