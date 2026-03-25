import { beforeEach, describe, expect, it, vi } from "vitest";

const { getReportMock, toApiErrorPayloadMock } = vi.hoisted(() => ({
  getReportMock: vi.fn(),
  toApiErrorPayloadMock: vi.fn(),
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

describe("GET /api/reports/[id]", () => {
  const validId = "550e8400-e29b-41d4-a716-446655440000";

  beforeEach(() => {
    getReportMock.mockReset();
    toApiErrorPayloadMock.mockReset();
  });

  it("returns 200 with report JSON when found", async () => {
    const report = { title: "Test report" };
    getReportMock.mockResolvedValue(report);

    const response = await GET(new Request("http://localhost/api/reports"), {
      params: { id: validId },
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(report);
    expect(getReportMock).toHaveBeenCalledWith(validId);
  });

  it("returns 400 for invalid report ids", async () => {
    const response = await GET(new Request("http://localhost/api/reports"), {
      params: { id: "   " },
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      code: "INVALID_INPUT",
      message: "Invalid report id.",
    });
    expect(getReportMock).not.toHaveBeenCalled();
  });

  it("returns 404 when report is missing", async () => {
    getReportMock.mockResolvedValue(null);

    const response = await GET(new Request("http://localhost/api/reports"), {
      params: { id: validId },
    });

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      code: "NOT_FOUND",
      message: "Report not found.",
    });
  });

  it("maps unexpected failures via toApiErrorPayload", async () => {
    const thrown = new Error("db unavailable");
    getReportMock.mockRejectedValue(thrown);
    toApiErrorPayloadMock.mockReturnValue({
      status: 503,
      code: "ANALYSIS_FAILED",
      message: "Analysis failed. Check server logs.",
    });

    const response = await GET(new Request("http://localhost/api/reports"), {
      params: { id: validId },
    });

    expect(toApiErrorPayloadMock).toHaveBeenCalledWith(thrown);
    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      code: "ANALYSIS_FAILED",
      message: "Analysis failed. Check server logs.",
    });
  });
});
