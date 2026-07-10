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

  it("GET fails closed in production without CRON_SECRET", async () => {
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

  it("POST fails closed in production without CRON_SECRET", async () => {
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
});
