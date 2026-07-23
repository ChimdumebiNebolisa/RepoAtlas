import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import fs from "fs";
import path from "path";
import os from "os";
import { randomUUID } from "crypto";
import type { Report } from "@/types/report";

const blob = vi.hoisted(() => {
  const store = new Map<string, { body: string; uploadedAt: Date }>();
  return {
    store,
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
        .filter(([pathname]) => pathname.startsWith(prefix))
        .map(([pathname, entry]) => ({
          pathname,
          url: `https://blob.local/${pathname}`,
          size: entry.body.length,
          uploadedAt: entry.uploadedAt,
      })),
      hasMore: false,
      cursor: undefined as string | undefined,
    })),
    del: vi.fn(async (pathname: string | string[]) => {
      for (const target of Array.isArray(pathname) ? pathname : [pathname]) {
        store.delete(target);
      }
    }),
  };
});

vi.mock("@vercel/blob", () => ({
  put: blob.put,
  get: blob.get,
  list: blob.list,
  del: blob.del,
}));

import { saveReport } from "@/lib/storage";
import {
  createShareLink,
  deleteSharesForReport,
  listShareTokens,
  resolveShareToken,
  sweepExpiredShareTokens,
} from "@/lib/sharing";

const DAY_MS = 24 * 60 * 60 * 1000;
const VALID_TOKEN = "A".repeat(32);

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

function record(
  reportId: string,
  createdAt = new Date(Date.now() - DAY_MS).toISOString(),
  expiresAt = new Date(Date.parse(createdAt) + 7 * DAY_MS).toISOString()
) {
  return { reportId, createdAt, expiresAt };
}

function expiredRecord(reportId: string) {
  const expiresAt = Date.now() - DAY_MS;
  return record(
    reportId,
    new Date(expiresAt - 7 * DAY_MS).toISOString(),
    new Date(expiresAt).toISOString()
  );
}

describe("filesystem-backed sharing", () => {
  let reportsDir: string;
  let reportId: string;
  let sharesDir: string;

  beforeEach(async () => {
    reportsDir = fs.mkdtempSync(path.join(os.tmpdir(), "repoatlas-share-"));
    process.env.REPORTS_DIR = reportsDir;
    reportId = randomUUID();
    sharesDir = path.join(reportsDir, "shares");
    await saveReport(reportId, minimalReport);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env.REPORTS_DIR;
    delete process.env.BLOB_READ_WRITE_TOKEN;
    delete process.env.VERCEL_OIDC_TOKEN;
    delete process.env.BLOB_STORE_ID;
    fs.rmSync(reportsDir, { recursive: true, force: true });
  });

  it("creates one exact seven-day share and reuses it", async () => {
    const share = await createShareLink(reportId);
    const duplicate = await createShareLink(reportId);
    const stored = JSON.parse(
      fs.readFileSync(path.join(sharesDir, `${share.token}.json`), "utf-8")
    ) as { createdAt: string; expiresAt: string };

    expect(share.sharePath).toBe(`/share/${share.token}`);
    expect(Date.parse(stored.expiresAt) - Date.parse(stored.createdAt)).toBe(
      7 * DAY_MS
    );
    expect(duplicate).toEqual(share);
    expect(await resolveShareToken(share.token)).toMatchObject({ reportId });
  });

  it("rejects a share request for a missing report", async () => {
    await expect(createShareLink(randomUUID())).rejects.toThrow("NOT_FOUND");
  });

  it.each([
    ["malformed JSON", "{"],
    ["a missing field", JSON.stringify({ reportId: randomUUID() })],
    [
      "an invalid expiry",
      JSON.stringify({
        reportId: randomUUID(),
        createdAt: new Date(Date.now() - DAY_MS).toISOString(),
        expiresAt: "not-a-date",
      }),
    ],
    [
      "a noncanonical timestamp",
      JSON.stringify({
        ...record(randomUUID()),
        createdAt: "2026-01-01T00:00:00Z",
        expiresAt: "2026-01-08T00:00:00.000Z",
      }),
    ],
    [
      "a future creation timestamp",
      JSON.stringify(
        record(
          randomUUID(),
          new Date(Date.now() + DAY_MS).toISOString(),
          new Date(Date.now() + 8 * DAY_MS).toISOString()
        )
      ),
    ],
    [
      "a non-seven-day lifetime",
      JSON.stringify(
        record(
          randomUUID(),
          new Date(Date.now() - DAY_MS).toISOString(),
          new Date(Date.now() + DAY_MS).toISOString()
        )
      ),
    ],
    [
      "an invalid report id",
      JSON.stringify(record("../../../private-report")),
    ],
  ])("does not load %s", async (_label, body) => {
    fs.mkdirSync(sharesDir, { recursive: true });
    fs.writeFileSync(path.join(sharesDir, `${VALID_TOKEN}.json`), body);

    expect(await resolveShareToken(VALID_TOKEN)).toBeNull();
  });

  it("deletes an expired record instead of resolving or reusing it", async () => {
    fs.mkdirSync(sharesDir, { recursive: true });
    fs.writeFileSync(
      path.join(sharesDir, `${VALID_TOKEN}.json`),
      JSON.stringify(expiredRecord(reportId))
    );

    expect(await resolveShareToken(VALID_TOKEN)).toBeNull();
    expect(fs.existsSync(path.join(sharesDir, `${VALID_TOKEN}.json`))).toBe(false);

    fs.writeFileSync(
      path.join(sharesDir, `${VALID_TOKEN}.json`),
      JSON.stringify(expiredRecord(reportId))
    );
    const fresh = await createShareLink(reportId);
    expect(fresh.token).not.toBe(VALID_TOKEN);
    expect(fs.existsSync(path.join(sharesDir, `${VALID_TOKEN}.json`))).toBe(false);
  });

  it("sweeps expired and malformed records but retains active records", async () => {
    const active = await createShareLink(reportId);
    fs.writeFileSync(path.join(sharesDir, `${VALID_TOKEN}.json`), "{");
    const expiredToken = "B".repeat(32);
    fs.writeFileSync(
      path.join(sharesDir, `${expiredToken}.json`),
      JSON.stringify(expiredRecord(randomUUID()))
    );

    const result = await sweepExpiredShareTokens();

    expect(result).toEqual({
      deleted: expect.arrayContaining([VALID_TOKEN, expiredToken]),
      scanned: 3,
    });
    expect(await resolveShareToken(active.token)).not.toBeNull();
  });

  it("deletes every valid share for one report without touching another", async () => {
    const first = await createShareLink(reportId);
    const otherReportId = randomUUID();
    await saveReport(otherReportId, minimalReport);
    const other = await createShareLink(otherReportId);

    expect(await deleteSharesForReport(reportId)).toEqual([first.token]);
    expect(await resolveShareToken(first.token)).toBeNull();
    expect(await resolveShareToken(other.token)).not.toBeNull();
  });

  it("lists only valid JSON token records and tolerates directory read failure", async () => {
    fs.mkdirSync(sharesDir, { recursive: true });
    fs.writeFileSync(path.join(sharesDir, `${VALID_TOKEN}.json`), "{}");
    fs.writeFileSync(path.join(sharesDir, "short.json"), "{}");
    fs.writeFileSync(path.join(sharesDir, `${"B".repeat(32)}.txt`), "{}");

    expect(await listShareTokens()).toEqual([VALID_TOKEN]);

    vi.spyOn(fs.promises, "readdir").mockRejectedValueOnce(
      new Error("unreadable")
    );
    expect(await listShareTokens()).toEqual([]);
  });

  it("removes the temporary record when the atomic rename fails", async () => {
    vi.spyOn(fs.promises, "rename").mockRejectedValueOnce(
      new Error("rename failed")
    );

    await expect(createShareLink(reportId)).rejects.toThrow("rename failed");
    expect(
      fs
        .readdirSync(sharesDir)
        .filter((file) => file.endsWith(".tmp"))
    ).toEqual([]);
  });
});

describe("private Blob-backed sharing", () => {
  let reportId: string;

  beforeEach(async () => {
    blob.store.clear();
    blob.put.mockClear();
    blob.get.mockClear();
    blob.list.mockClear();
    blob.del.mockClear();
    process.env.BLOB_READ_WRITE_TOKEN = "test-token";
    reportId = randomUUID();
    await saveReport(reportId, minimalReport);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    blob.store.clear();
    delete process.env.BLOB_READ_WRITE_TOKEN;
    delete process.env.VERCEL_OIDC_TOKEN;
    delete process.env.BLOB_STORE_ID;
  });

  it("creates, resolves, reuses, and deletes a private Blob record", async () => {
    const share = await createShareLink(reportId);

    expect(blob.put).toHaveBeenCalledWith(
      `shares/${share.token}.json`,
      expect.any(String),
      expect.objectContaining({
        access: "private",
        allowOverwrite: true,
        token: "test-token",
      })
    );
    expect(await createShareLink(reportId)).toEqual(share);
    expect(await resolveShareToken(share.token)).toMatchObject({ reportId });
    expect(await deleteSharesForReport(reportId)).toEqual([share.token]);
    expect(await resolveShareToken(share.token)).toBeNull();
  });

  it("uses OIDC storage without passing a static token", async () => {
    delete process.env.BLOB_READ_WRITE_TOKEN;
    process.env.VERCEL_OIDC_TOKEN = "test-oidc";
    process.env.BLOB_STORE_ID = "store_test";

    const share = await createShareLink(reportId);

    expect(blob.put).toHaveBeenCalledWith(
      `shares/${share.token}.json`,
      expect.any(String),
      expect.not.objectContaining({ token: expect.anything() })
    );
    expect(await resolveShareToken(share.token)).not.toBeNull();
  });

  it("paginates Blob records and ignores unrelated or invalid paths", async () => {
    const secondToken = "B".repeat(32);
    blob.list
      .mockResolvedValueOnce({
        blobs: [
          {
            pathname: `shares/${VALID_TOKEN}.json`,
            url: "",
            size: 1,
            uploadedAt: new Date(),
          },
          {
            pathname: "shares/short.json",
            url: "",
            size: 1,
            uploadedAt: new Date(),
          },
        ],
        hasMore: true,
        cursor: "next",
      })
      .mockResolvedValueOnce({
        blobs: [
          {
            pathname: `shares/${secondToken}.json`,
            url: "",
            size: 1,
            uploadedAt: new Date(),
          },
          {
            pathname: "reports/not-a-share.json",
            url: "",
            size: 1,
            uploadedAt: new Date(),
          },
        ],
        hasMore: false,
        cursor: undefined,
      });

    expect(await listShareTokens()).toEqual([VALID_TOKEN, secondToken]);
    expect(blob.list).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ cursor: "next", token: "test-token" })
    );
  });

  it("returns null when a Blob read fails or has no readable body", async () => {
    blob.get.mockRejectedValueOnce(new Error("blob unavailable"));
    await expect(resolveShareToken(VALID_TOKEN)).resolves.toBeNull();

    blob.get.mockResolvedValueOnce({ statusCode: 500, stream: null });
    await expect(resolveShareToken(VALID_TOKEN)).resolves.toBeNull();
  });

  it("rejects malformed Blob records and does not reuse them", async () => {
    blob.store.set(`shares/${VALID_TOKEN}.json`, {
      body: JSON.stringify({
        reportId,
        createdAt: new Date(Date.now() - DAY_MS).toISOString(),
        expiresAt: "not-a-date",
      }),
      uploadedAt: new Date(),
    });

    expect(await resolveShareToken(VALID_TOKEN)).toBeNull();
    const share = await createShareLink(reportId);
    expect(share.token).not.toBe(VALID_TOKEN);
  });

  it("keeps cleanup best-effort when Blob deletion fails", async () => {
    const share = await createShareLink(reportId);
    const stored = JSON.parse(
      blob.store.get(`shares/${share.token}.json`)?.body ?? "null"
    ) as { createdAt: string; expiresAt: string; reportId: string };
    const expired = expiredRecord(reportId);
    stored.createdAt = expired.createdAt;
    stored.expiresAt = expired.expiresAt;
    blob.store.set(`shares/${share.token}.json`, {
      body: JSON.stringify(stored),
      uploadedAt: new Date(),
    });
    blob.del.mockRejectedValueOnce(new Error("delete unavailable"));

    expect(await resolveShareToken(share.token)).toBeNull();
  });
});
