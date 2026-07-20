import { beforeEach, describe, expect, it, vi } from "vitest";

const { sweepExpiredReportsMock, sweepExpiredShareTokensMock } = vi.hoisted(() => ({
  sweepExpiredReportsMock: vi.fn(),
  sweepExpiredShareTokensMock: vi.fn(),
}));

vi.mock("@/lib/storage", () => ({
  sweepExpiredReports: sweepExpiredReportsMock,
}));

vi.mock("@/lib/sharing", () => ({
  sweepExpiredShareTokens: sweepExpiredShareTokensMock,
}));

import { GET, POST } from "./route";

describe("cron cleanup route", () => {
  beforeEach(() => {
    sweepExpiredReportsMock.mockReset();
    sweepExpiredShareTokensMock.mockReset();
    delete process.env.CRON_SECRET;
    delete process.env.VERCEL;
  });

  it("GET returns ok health when not in production", async () => {
    const response = await GET(new Request("http://localhost/api/cron/cleanup"));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.ok).toBe(true);
  });

  it("GET fails closed on Vercel without CRON_SECRET", async () => {
    process.env.VERCEL = "1";
    const response = await GET(new Request("http://localhost/api/cron/cleanup"));
    expect(response.status).toBe(503);
  });

  it("POST runs sweeps without auth when CRON_SECRET is unset (non-production)", async () => {
    sweepExpiredReportsMock.mockResolvedValue({
      deleted: ["old-id"],
      retained: 1,
      scanned: 2,
      skippedBlob: false,
    });
    sweepExpiredShareTokensMock.mockResolvedValue({ deleted: ["tok"], scanned: 1 });

    const response = await POST(new Request("http://localhost/api/cron/cleanup", { method: "POST" }));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.reports.deleted).toEqual(["old-id"]);
    expect(body.shares.deleted).toEqual(["tok"]);
    expect(body.scannedAt).toBeTruthy();
  });

  it("POST fails closed on Vercel without CRON_SECRET", async () => {
    process.env.VERCEL = "1";
    const response = await POST(new Request("http://localhost/api/cron/cleanup", { method: "POST" }));
    expect(response.status).toBe(503);
    expect(sweepExpiredReportsMock).not.toHaveBeenCalled();
  });

  it("POST rejects invalid cron secret", async () => {
    process.env.CRON_SECRET = "secret-token";

    const response = await POST(
      new Request("http://localhost/api/cron/cleanup", {
        method: "POST",
        headers: { authorization: "Bearer wrong" },
      })
    );

    expect(response.status).toBe(401);
    expect(sweepExpiredReportsMock).not.toHaveBeenCalled();
  });

  it("GET rejects an invalid cron secret", async () => {
    process.env.CRON_SECRET = "secret-token";

    const response = await GET(
      new Request("http://localhost/api/cron/cleanup", {
        headers: { authorization: "Bearer wrong" },
      })
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      code: "UNAUTHORIZED",
      message: "Invalid cron secret.",
    });
  });

  it("returns a generic failure without report content when a sweep fails", async () => {
    process.env.CRON_SECRET = "secret-token";
    sweepExpiredReportsMock.mockRejectedValue(
      new Error("private-report-id private repository content")
    );
    sweepExpiredShareTokensMock.mockResolvedValue({ deleted: [], scanned: 0 });
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);

    const response = await POST(
      new Request("http://localhost/api/cron/cleanup", {
        method: "POST",
        headers: { authorization: "Bearer secret-token" },
      })
    );

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      code: "CLEANUP_FAILED",
      message: "Cleanup failed. Check server logs.",
      requestId: expect.stringMatching(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
      ),
    });
    expect(consoleError).toHaveBeenCalledOnce();
    const logLine = String(consoleError.mock.calls[0]?.[0]);
    expect(logLine).toContain('"event":"retention_cleanup_failed"');
    expect(logLine).not.toMatch(/private-report-id|private repository content|secret-token/);
  });
});
