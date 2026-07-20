import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { AppError, ERROR_CODES, type ErrorCode } from "@/lib/errors";

const analyzeRepository = vi.hoisted(() => vi.fn());
const releaseSlot = vi.hoisted(() => vi.fn());

vi.mock("@/analyzer", () => ({ analyzeRepository }));
vi.mock("@/lib/storageConfig", () => ({ canPersistReports: () => false }));
vi.mock("@/lib/rateLimit", () => ({
  clientKeyFromHeaders: () => "bounded-test-client",
  getMaxConcurrentAnalyses: () => 4,
  getRateLimiter: () => ({
    check: async () => ({ allowed: true, bestEffort: true }),
  }),
  tryAcquireAnalysisSlot: () => ({ release: releaseSlot }),
}));

import { POST } from "./route";

function analyzeRequest() {
  return new NextRequest("http://localhost/api/analyze", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      githubUrl: "https://github.com/private-owner/private-repository",
      ref: "private-ref-name",
    }),
  });
}

interface FailureCase {
  label: string;
  code: ErrorCode;
  status: number;
  message: string;
  meta?: Record<string, unknown>;
}

const failures: FailureCase[] = [
  {
    label: "GitHub rate limit",
    code: ERROR_CODES.RATE_LIMITED,
    status: 429,
    message: "GitHub rate limit reached.",
    meta: { status: 403 },
  },
  {
    label: "analysis timeout",
    code: ERROR_CODES.TIMEOUT,
    status: 504,
    message: "Analysis timed out.",
  },
  {
    label: "oversized archive",
    code: ERROR_CODES.REPO_TOO_LARGE,
    status: 413,
    message: "Repository archive exceeds the size limit.",
    meta: { contentLength: 104_857_601 },
  },
  {
    label: "private or missing repository",
    code: ERROR_CODES.REPO_NOT_FOUND,
    status: 404,
    message: "Repository not found (it may be private).",
    meta: { status: 404 },
  },
  {
    label: "invalid ref",
    code: ERROR_CODES.MISSING_REF,
    status: 404,
    message: "Requested branch or tag was not found.",
    meta: { status: 404 },
  },
];

describe("POST /api/analyze failure states", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  for (const failure of failures) {
    it(`returns a bounded response for ${failure.label}`, async () => {
      analyzeRepository.mockRejectedValueOnce(
        new AppError({
          code: failure.code,
          status: failure.status,
          message: failure.message,
          meta: {
            ...failure.meta,
            githubUrl: "https://github.com/private-owner/private-repository",
            ref: "private-ref-name",
            reportId: "private-report-token",
          },
          cause: new Error("private upstream detail"),
        })
      );
      const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);

      const response = await POST(analyzeRequest());
      const body = await response.json();

      expect(response.status).toBe(failure.status);
      expect(body.code).toBe(failure.code);
      expect(body.message).toBeTruthy();
      expect(body.requestId).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
      );
      expect(analyzeRepository).toHaveBeenCalledWith(
        expect.objectContaining({ kind: "github" }),
        expect.objectContaining({ requestId: body.requestId })
      );
      if (failure.code === ERROR_CODES.RATE_LIMITED) {
        expect(response.headers.get("retry-after")).toBe("60");
      }

      expect(releaseSlot).toHaveBeenCalledOnce();
      expect(consoleError).toHaveBeenCalledOnce();
      const logLine = String(consoleError.mock.calls[0]?.[0]);
      expect(logLine).toContain(failure.code);
      expect(logLine).not.toMatch(
        /private-owner|private-repository|private-ref-name|private-report-token|private upstream detail/
      );
    });
  }
});
