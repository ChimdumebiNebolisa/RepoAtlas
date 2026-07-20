import { beforeEach, describe, expect, it, vi } from "vitest";

const { createShareLinkMock, getReportMock, toApiErrorPayloadMock } = vi.hoisted(() => ({
  createShareLinkMock: vi.fn(),
  getReportMock: vi.fn(),
  toApiErrorPayloadMock: vi.fn(),
}));

vi.mock("@/lib/sharing", () => ({
  createShareLink: createShareLinkMock,
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

import { POST } from "./route";

describe("POST /api/reports/[id]/share", () => {
  const validId = "550e8400-e29b-41d4-a716-446655440000";

  beforeEach(() => {
    createShareLinkMock.mockReset();
    getReportMock.mockReset();
    toApiErrorPayloadMock.mockReset();
  });

  it("creates a share without exposing the report contents", async () => {
    getReportMock.mockResolvedValue({ private: "report contents" });
    createShareLinkMock.mockResolvedValue({
      token: "safe-share-token-1234567890",
      sharePath: "/share/safe-share-token-1234567890",
      expiresAt: "2026-07-27T12:00:00.000Z",
    });

    const response = await POST(new Request("http://localhost/api/reports/share"), {
      params: Promise.resolve({ id: ` ${validId} ` }),
    });

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual({
      token: "safe-share-token-1234567890",
      sharePath: "/share/safe-share-token-1234567890",
      expiresAt: "2026-07-27T12:00:00.000Z",
    });
    expect(getReportMock).toHaveBeenCalledWith(validId);
    expect(createShareLinkMock).toHaveBeenCalledWith(validId);
  });

  it.each(["", "not-a-report-id", "550e8400-e29b-71d4-a716-446655440000"])(
    "rejects the invalid report id %j before storage access",
    async (id) => {
      const response = await POST(new Request("http://localhost/api/reports/share"), {
        params: Promise.resolve({ id }),
      });

      expect(response.status).toBe(400);
      await expect(response.json()).resolves.toEqual({
        code: "INVALID_INPUT",
        message: "Invalid report id.",
      });
      expect(getReportMock).not.toHaveBeenCalled();
      expect(createShareLinkMock).not.toHaveBeenCalled();
    }
  );

  it("returns 404 when the report is missing", async () => {
    getReportMock.mockResolvedValue(null);

    const response = await POST(new Request("http://localhost/api/reports/share"), {
      params: Promise.resolve({ id: validId }),
    });

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      code: "NOT_FOUND",
      message: "Report not found.",
    });
    expect(createShareLinkMock).not.toHaveBeenCalled();
  });

  it("keeps a storage race as a not-found response", async () => {
    getReportMock.mockResolvedValue({ title: "report" });
    createShareLinkMock.mockRejectedValue(new Error("NOT_FOUND"));

    const response = await POST(new Request("http://localhost/api/reports/share"), {
      params: Promise.resolve({ id: validId }),
    });

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      code: "NOT_FOUND",
      message: "Report not found.",
    });
  });

  it("maps internal errors to a sanitized response", async () => {
    const thrown = new Error("private storage failure");
    getReportMock.mockRejectedValue(thrown);
    toApiErrorPayloadMock.mockReturnValue({
      status: 500,
      code: "ANALYSIS_FAILED",
      message: "Analysis failed. Check server logs.",
    });

    const response = await POST(new Request("http://localhost/api/reports/share"), {
      params: Promise.resolve({ id: validId }),
    });

    expect(toApiErrorPayloadMock).toHaveBeenCalledWith(thrown);
    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      code: "ANALYSIS_FAILED",
      message: "Analysis failed. Check server logs.",
    });
  });
});
