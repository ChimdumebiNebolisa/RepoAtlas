import { describe, expect, it, beforeEach, afterEach } from "vitest";
import fs from "fs";
import path from "path";
import os from "os";
import { randomUUID } from "crypto";
import type { Report } from "@/types/report";
import { saveReport } from "@/lib/storage";
import { createShareLink, resolveShareToken } from "@/lib/sharing";

const minimalReport: Report = {
  repo_metadata: {
    name: "share-test",
    url: "zip",
    branch: "main",
    clone_hash: null,
    analyzed_at: new Date().toISOString(),
  },
  folder_map: { path: ".", type: "dir", children: [] },
  architecture: { nodes: [], edges: [] },
  start_here: [],
  danger_zones: [],
  run_commands: [],
  contribute_signals: { key_docs: [], ci_configs: [] },
  warnings: [],
};

describe("sharing", () => {
  let reportsDir: string;
  let reportId: string;

  beforeEach(async () => {
    reportsDir = fs.mkdtempSync(path.join(os.tmpdir(), "repoatlas-share-"));
    process.env.REPORTS_DIR = reportsDir;
    reportId = randomUUID();
    await saveReport(reportId, minimalReport);
  });

  afterEach(() => {
    delete process.env.REPORTS_DIR;
    fs.rmSync(reportsDir, { recursive: true, force: true });
  });

  it("creates a share token that resolves to the report id", async () => {
    const share = await createShareLink(reportId);
    expect(share.token).toBeTruthy();
    expect(share.sharePath).toBe(`/share/${share.token}`);

    const record = await resolveShareToken(share.token);
    expect(record?.reportId).toBe(reportId);
  });

  it("returns null for unknown tokens", async () => {
    expect(await resolveShareToken("not-a-valid-token-at-all")).toBeNull();
  });
});
