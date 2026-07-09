import { beforeEach, describe, expect, it, vi } from "vitest";

const { sweepExpiredReportsMock, sweepExpiredShareTokensMock } = vi.hoisted(() => ({
  sweepExpiredReportsMock: vi.fn(),
  sweepExpiredShareTokensMock: vi.fn(),
}));

vi.mock("@/lib/storage", () => ({
  listReportIds: vi.fn().mockResolvedValue(["a", "b"]),
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
  });

  it("GET returns report inventory metadata", async () => {
    const response = await GET();
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.reportCount).toBe(2);
    expect(body.ttlDays).toBeGreaterThan(0);
    expect(body.maxReports).toBeGreaterThan(0);
  });

  it("POST runs sweeps without auth when CRON_SECRET is unset", async () => {
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
