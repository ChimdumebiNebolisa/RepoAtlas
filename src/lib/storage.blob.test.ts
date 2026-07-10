import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { randomUUID } from "crypto";
import type { Report } from "@/types/report";

// In-memory blob store shared with the mock below.
const store = new Map<string, { body: string; uploadedAt: Date }>();

vi.mock("@vercel/blob", () => ({
  put: vi.fn(async (pathname: string, body: string) => {
    store.set(pathname, { body, uploadedAt: new Date() });
    return { pathname, url: `https://blob.local/${pathname}` };
  }),
  get: vi.fn(async (pathname: string) => {
    const entry = store.get(pathname);
    if (!entry) return { statusCode: 404, stream: null };
    return {
      statusCode: 200,
      stream: new Response(entry.body).body,
    };
  }),
  list: vi.fn(async ({ prefix }: { prefix: string }) => ({
    blobs: [...store.entries()]
      .filter(([p]) => p.startsWith(prefix))
      .map(([pathname, v]) => ({ pathname, url: `https://blob.local/${pathname}`, size: v.body.length, uploadedAt: v.uploadedAt })),
    hasMore: false,
    cursor: undefined,
  })),
  del: vi.fn(async (pathname: string | string[]) => {
    for (const p of Array.isArray(pathname) ? pathname : [pathname]) store.delete(p);
  }),
}));

import {
  saveReport,
  getReport,
  listReportIds,
  deleteReport,
  sweepExpiredReports,
} from "@/lib/storage";

const minimalReport = (analyzedAt: string): Report => ({
  repo_metadata: {
    name: "blob-test",
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

describe("blob-backed storage", () => {
  beforeEach(() => {
    store.clear();
    process.env.BLOB_READ_WRITE_TOKEN = "test-token";
    process.env.REPORT_MAX_COUNT = "2";
    process.env.REPORT_TTL_DAYS = "1";
  });

  afterEach(() => {
    delete process.env.BLOB_READ_WRITE_TOKEN;
    delete process.env.REPORT_MAX_COUNT;
    delete process.env.REPORT_TTL_DAYS;
  });

  it("saves, reads, lists and deletes blob reports", async () => {
    const id = randomUUID();
    await saveReport(id, minimalReport(new Date().toISOString()));
    expect(await listReportIds()).toContain(id);
    expect(await getReport(id)).not.toBeNull();

    expect(await deleteReport(id)).toBe(true);
    expect(await listReportIds()).not.toContain(id);
  });

  it("sweeps blob reports over the max count keeping newest", async () => {
    const ids = [randomUUID(), randomUUID(), randomUUID()];
    for (const id of ids) {
      await saveReport(id, minimalReport(new Date().toISOString()));
      // Ensure distinct upload times so newest can be determined.
      await new Promise((r) => setTimeout(r, 5));
    }

    const result = await sweepExpiredReports();
    expect(result.skippedBlob).toBe(false);
    expect(result.deleted.length).toBeGreaterThanOrEqual(1);
    const remaining = await listReportIds();
    // Newest report is retained.
    expect(remaining).toContain(ids[2]);
  });

  it("rejects invalid report ids without touching storage", async () => {
    expect(await getReport("../secrets")).toBeNull();
    expect(await deleteReport("not-a-uuid")).toBe(false);
  });
});
