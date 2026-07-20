import { beforeEach, describe, expect, it, vi } from "vitest";

const { getReportMock, resolveShareTokenMock, toApiErrorPayloadMock } = vi.hoisted(() => ({
  getReportMock: vi.fn(),
  resolveShareTokenMock: vi.fn(),
  toApiErrorPayloadMock: vi.fn(),
}));

vi.mock("@/lib/sharing", () => ({
  resolveShareToken: resolveShareTokenMock,
}));

vi.mock("@/lib/storage", () => ({
  getReport: getReportMock,
}));

vi.mock("@/lib/errors", () => ({
  ERROR_CODES: {
    INVALID_INPUT: "INVALID_INPUT",
  },
  toApiErrorPayload: toApiErrorPayloadMock,
}));

import { GET } from "./route";

describe("GET /api/share/[token]", () => {
  const validToken = "safe_share-token-1234567890";
  const record = {
    reportId: "550e8400-e29b-41d4-a716-446655440000",
    createdAt: "2026-07-20T12:00:00.000Z",
    expiresAt: "2026-07-27T12:00:00.000Z",
  };

  beforeEach(() => {
    getReportMock.mockReset();
    resolveShareTokenMock.mockReset();
    toApiErrorPayloadMock.mockReset();
  });

  function expectNoStore(response: Response) {
    expect(response.headers.get("cache-control")).toBe("no-store");
  }

  it.each(["", "short", "invalid token with spaces", "a".repeat(65)])(
    "rejects the invalid token %j before storage access",
    async (token) => {
      const response = await GET(new Request("http://localhost/api/share"), {
        params: Promise.resolve({ token }),
      });

      expect(response.status).toBe(400);
      await expect(response.json()).resolves.toEqual({
        code: "INVALID_INPUT",
        message: "Invalid share token.",
      });
      expect(resolveShareTokenMock).not.toHaveBeenCalled();
      expect(getReportMock).not.toHaveBeenCalled();
      expectNoStore(response);
    }
  );

  it("returns 404 without storage access for an expired share", async () => {
    resolveShareTokenMock.mockResolvedValue(null);

    const response = await GET(new Request("http://localhost/api/share"), {
      params: Promise.resolve({ token: validToken }),
    });

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      code: "NOT_FOUND",
      message: "Share link expired or not found.",
    });
    expect(getReportMock).not.toHaveBeenCalled();
    expectNoStore(response);
  });

  it("returns 404 when the shared report is missing", async () => {
    resolveShareTokenMock.mockResolvedValue(record);
    getReportMock.mockResolvedValue(null);

    const response = await GET(new Request("http://localhost/api/share"), {
      params: Promise.resolve({ token: validToken }),
    });

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      code: "NOT_FOUND",
      message: "Report not found.",
    });
    expect(getReportMock).toHaveBeenCalledWith(record.reportId);
    expectNoStore(response);
  });

  it("returns the private report and bounded share metadata without caching", async () => {
    const report = { title: "Private candidate brief" };
    resolveShareTokenMock.mockResolvedValue(record);
    getReportMock.mockResolvedValue(report);

    const response = await GET(new Request("http://localhost/api/share"), {
      params: Promise.resolve({ token: ` ${validToken} ` }),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      report,
      share: {
        createdAt: record.createdAt,
        expiresAt: record.expiresAt,
      },
    });
    expect(resolveShareTokenMock).toHaveBeenCalledWith(validToken);
    expectNoStore(response);
  });

  it.each([
    ["token storage", "resolve", resolveShareTokenMock],
    ["report storage", "report", getReportMock],
  ])("sanitizes %s errors and keeps the response non-cacheable", async (_label, stage, mock) => {
    const thrown = new Error("private storage failure");
    if (stage === "report") {
      resolveShareTokenMock.mockResolvedValue(record);
    }
    mock.mockRejectedValue(thrown);
    toApiErrorPayloadMock.mockReturnValue({
      status: 503,
      code: "ANALYSIS_FAILED",
      message: "Analysis failed. Check server logs.",
    });

    const response = await GET(new Request("http://localhost/api/share"), {
      params: Promise.resolve({ token: validToken }),
    });

    expect(toApiErrorPayloadMock).toHaveBeenCalledWith(thrown);
    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      code: "ANALYSIS_FAILED",
      message: "Analysis failed. Check server logs.",
    });
    expectNoStore(response);
  });
});
