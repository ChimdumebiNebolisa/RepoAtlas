import fs from "fs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { AppError, ERROR_CODES, type ErrorCode } from "@/lib/errors";
import { maxCompressedBytesForZipUpload } from "@/lib/ingestLimits";

const mocks = vi.hoisted(() => ({
  analyzeRepository: vi.fn(),
  canPersistReports: vi.fn(),
  checkRateLimit: vi.fn(),
  clientKeyFromHeaders: vi.fn(),
  getMaxConcurrentAnalyses: vi.fn(),
  releaseSlot: vi.fn(),
  tryAcquireAnalysisSlot: vi.fn(),
}));

vi.mock("@/analyzer", () => ({ analyzeRepository: mocks.analyzeRepository }));
vi.mock("@/lib/storageConfig", () => ({ canPersistReports: mocks.canPersistReports }));
vi.mock("@/lib/rateLimit", () => ({
  clientKeyFromHeaders: mocks.clientKeyFromHeaders,
  getMaxConcurrentAnalyses: mocks.getMaxConcurrentAnalyses,
  getRateLimiter: () => ({ check: mocks.checkRateLimit }),
  tryAcquireAnalysisSlot: mocks.tryAcquireAnalysisSlot,
}));

import { POST } from "./route";

const inlineReport = { repo: { name: "repo-ts" } };

function jsonRequest(
  body: unknown,
  init: Omit<RequestInit, "method" | "body" | "signal"> & { signal?: AbortSignal } = {}
) {
  return new NextRequest("http://localhost/api/analyze", {
    ...init,
    method: "POST",
    headers: { "content-type": "application/json", ...init.headers },
    body: JSON.stringify(body),
  });
}

function rawRequest(body: BodyInit | null, contentType?: string, signal?: AbortSignal) {
  return new NextRequest("http://localhost/api/analyze", {
    method: "POST",
    headers: contentType ? { "content-type": contentType } : undefined,
    body,
    signal,
  });
}

function multipartRequest(entries: Record<string, string | Blob>) {
  const form = new FormData();
  for (const [key, value] of Object.entries(entries)) form.set(key, value);
  return new NextRequest("http://localhost/api/analyze", { method: "POST", body: form });
}

function mockSuccess(persisted = false) {
  mocks.analyzeRepository.mockResolvedValueOnce({
    reportId: "report-123",
    report: inlineReport,
    persisted,
  });
}

async function expectInvalid(request: NextRequest, message: string, status = 400) {
  const response = await POST(request);
  expect(response.status).toBe(status);
  await expect(response.json()).resolves.toMatchObject({
    code: status === 413 ? ERROR_CODES.REPO_TOO_LARGE : ERROR_CODES.INVALID_INPUT,
    message,
  });
  expect(mocks.analyzeRepository).not.toHaveBeenCalled();
  expect(mocks.releaseSlot).toHaveBeenCalledOnce();
}

beforeEach(() => {
  for (const mock of Object.values(mocks)) mock.mockReset();
  mocks.canPersistReports.mockReturnValue(false);
  mocks.checkRateLimit.mockResolvedValue({ allowed: true, bestEffort: true });
  mocks.clientKeyFromHeaders.mockReturnValue("bounded-test-client");
  mocks.getMaxConcurrentAnalyses.mockReturnValue(4);
  mocks.tryAcquireAnalysisSlot.mockReturnValue({ release: mocks.releaseSlot });
});

describe("POST /api/analyze request boundary", () => {
  it("returns an inline sample report with the default interview intent", async () => {
    mockSuccess();

    const response = await POST(jsonRequest({ sample: true }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      reportId: "report-123",
      report: inlineReport,
      persisted: false,
    });
    expect(mocks.analyzeRepository).toHaveBeenCalledWith(
      expect.objectContaining({ kind: "zip", zipName: "repo-ts" }),
      expect.objectContaining({
        analysisIntent: "interview",
        allowInlineFallback: true,
        persist: false,
        signal: expect.any(AbortSignal),
      })
    );
    expect(mocks.releaseSlot).toHaveBeenCalledOnce();
  });

  it("returns only the report id when persistence succeeds", async () => {
    mocks.canPersistReports.mockReturnValue(true);
    mockSuccess(true);

    const response = await POST(jsonRequest({ sample: true }));

    await expect(response.json()).resolves.toEqual({ reportId: "report-123", persisted: true });
    expect(mocks.analyzeRepository).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ persist: true })
    );
  });

  it("normalizes a GitHub URL and optional ref", async () => {
    mockSuccess();

    await POST(
      jsonRequest({
        githubUrl: "  https://github.com/owner/repository  ",
        ref: "  release/v1  ",
        analysisIntent: "planned_change",
      })
    );

    expect(mocks.analyzeRepository).toHaveBeenCalledWith(
      {
        kind: "github",
        githubUrl: "https://github.com/owner/repository",
        ref: "release/v1",
      },
      expect.objectContaining({ analysisIntent: "planned_change" })
    );
  });

  it("omits a blank GitHub ref", async () => {
    mockSuccess();

    await POST(jsonRequest({ githubUrl: "https://github.com/owner/repository", ref: "  " }));

    expect(mocks.analyzeRepository).toHaveBeenCalledWith(
      { kind: "github", githubUrl: "https://github.com/owner/repository", ref: undefined },
      expect.anything()
    );
  });

  it.each(["interview", "bug", "planned_change", "pull_request"] as const)(
    "accepts the exact %s analysis intent",
    async (analysisIntent) => {
      mockSuccess();

      await POST(jsonRequest({ sample: true, analysisIntent }));

      expect(mocks.analyzeRepository).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ analysisIntent })
      );
    }
  );

  it("accepts a multipart ZIP and removes the temporary file after success", async () => {
    let uploadedPath = "";
    mocks.analyzeRepository.mockImplementationOnce(async (input) => {
      uploadedPath = input.zipRef;
      expect(fs.existsSync(uploadedPath)).toBe(true);
      return { reportId: "report-123", report: inlineReport, persisted: false };
    });

    const response = await POST(
      multipartRequest({
        analysisIntent: "bug",
        file: new File([Buffer.from("PK\u0003\u0004fixture")], "candidate.zip", {
          type: "application/zip",
        }),
      })
    );

    expect(response.status).toBe(200);
    expect(mocks.analyzeRepository).toHaveBeenCalledWith(
      expect.objectContaining({ kind: "zip", zipName: "candidate.zip" }),
      expect.objectContaining({ analysisIntent: "bug" })
    );
    expect(uploadedPath).toMatch(/repoatlas-[0-9a-f-]+\.zip$/i);
    expect(fs.existsSync(uploadedPath)).toBe(false);
    expect(mocks.releaseSlot).toHaveBeenCalledOnce();
  });

  it("accepts the legacy multipart zip field without a filename", async () => {
    mockSuccess();

    await POST(multipartRequest({ zip: new Blob(["PK\u0003\u0004fixture"]) }));

    expect(mocks.analyzeRepository).toHaveBeenCalledWith(
      expect.objectContaining({ kind: "zip", zipName: "blob" }),
      expect.anything()
    );
  });

  it("removes the uploaded temporary file when analysis fails", async () => {
    let uploadedPath = "";
    mocks.analyzeRepository.mockImplementationOnce(async (input) => {
      uploadedPath = input.zipRef;
      throw new AppError({
        code: ERROR_CODES.ZIP_INVALID,
        status: 400,
        message: "Invalid zip.",
      });
    });
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    const response = await POST(
      multipartRequest({ file: new File(["not-a-zip"], "broken.zip") })
    );

    expect(response.status).toBe(400);
    expect(fs.existsSync(uploadedPath)).toBe(false);
    expect(mocks.releaseSlot).toHaveBeenCalledOnce();
  });

  it("ignores a temporary-file cleanup failure after returning a report", async () => {
    mockSuccess();
    const unlink = vi.spyOn(fs.promises, "unlink").mockRejectedValueOnce(new Error("busy"));

    const response = await POST(
      multipartRequest({ file: new File(["fixture"], "cleanup.zip") })
    );

    expect(response.status).toBe(200);
    expect(unlink).toHaveBeenCalledOnce();
    unlink.mockRestore();
  });

  it("rejects an oversized ZIP before writing or analyzing it", async () => {
    const oversized = new Blob([new Uint8Array(maxCompressedBytesForZipUpload() + 1)]);

    const response = await POST(multipartRequest({ file: oversized }));

    expect(response.status).toBe(413);
    await expect(response.json()).resolves.toMatchObject({ code: ERROR_CODES.REPO_TOO_LARGE });
    expect(mocks.analyzeRepository).not.toHaveBeenCalled();
    expect(mocks.releaseSlot).toHaveBeenCalledOnce();
  });

  it("returns a bounded error when analysis produces no report id", async () => {
    mocks.analyzeRepository.mockResolvedValueOnce({
      reportId: "",
      report: inlineReport,
      persisted: false,
    });

    const response = await POST(jsonRequest({ sample: true }));

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toMatchObject({
      code: ERROR_CODES.ANALYSIS_FAILED,
      message: "No report produced",
      requestId: expect.any(String),
    });
    expect(mocks.releaseSlot).toHaveBeenCalledOnce();
  });

  it("forwards a request abort to the analyzer and still releases its slot", async () => {
    const requestController = new AbortController();
    mocks.analyzeRepository.mockImplementationOnce(async (_input, options) => {
      return await new Promise((_resolve, reject) => {
        options.signal.addEventListener(
          "abort",
          () =>
            reject(
              new AppError({
                code: ERROR_CODES.TIMEOUT,
                status: 504,
                message: "Analysis timed out.",
              })
            ),
          { once: true }
        );
      });
    });
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    const responsePromise = POST(
      jsonRequest({ sample: true }, { signal: requestController.signal })
    );
    await vi.waitFor(() => expect(mocks.analyzeRepository).toHaveBeenCalledOnce());
    requestController.abort();
    const response = await responsePromise;

    expect(response.status).toBe(504);
    await expect(response.json()).resolves.toMatchObject({ code: ERROR_CODES.TIMEOUT });
    expect(mocks.releaseSlot).toHaveBeenCalledOnce();
  });

  it("passes an already-aborted signal to the analyzer", async () => {
    const requestController = new AbortController();
    const request = jsonRequest({ sample: true }, { signal: requestController.signal });
    requestController.abort();
    mocks.analyzeRepository.mockImplementationOnce(async (_input, options) => {
      expect(options.signal.aborted).toBe(true);
      throw new AppError({
        code: ERROR_CODES.TIMEOUT,
        status: 504,
        message: "Analysis timed out.",
      });
    });
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    const response = await POST(request);

    expect(response.status).toBe(504);
    expect(mocks.releaseSlot).toHaveBeenCalledOnce();
  });
});

describe("POST /api/analyze validation", () => {
  it("rejects malformed JSON", async () => {
    await expectInvalid(
      rawRequest("{", "application/json"),
      "Request body is not valid JSON."
    );
  });

  it("rejects JSON values that are not objects", async () => {
    await expectInvalid(jsonRequest(null), "Provide a JSON object.");
  });

  it.each(["interviews", "Interview", 3])("rejects unsupported intent %j", async (value) => {
    await expectInvalid(
      jsonRequest({ sample: true, analysisIntent: value }),
      "Choose a supported analysis intent."
    );
  });

  it("rejects an unsupported multipart intent", async () => {
    await expectInvalid(
      multipartRequest({ analysisIntent: "security", file: new Blob(["fixture"]) }),
      "Choose a supported analysis intent."
    );
  });

  it("rejects multipart requests without a file", async () => {
    await expectInvalid(multipartRequest({ analysisIntent: "interview" }), "Upload a single zip file.");
  });

  it("rejects multipart requests with a string file field", async () => {
    await expectInvalid(multipartRequest({ file: "not-a-file" }), "Upload a single zip file.");
  });

  it("rejects malformed multipart data as invalid input", async () => {
    await expectInvalid(
      rawRequest("not multipart", "multipart/form-data; boundary=missing"),
      "Request body is not valid multipart form data."
    );
  });

  it("rejects caller-controlled zipRef paths", async () => {
    await expectInvalid(
      jsonRequest({ zipRef: "/private/server/path.zip" }),
      "zipRef is not accepted. Upload a zip file or provide a public GitHub URL."
    );
  });

  it("rejects JSON without a supported repository selection", async () => {
    await expectInvalid(
      jsonRequest({ githubUrl: "   " }),
      "Provide a GitHub repository URL, upload a zip file, or request the sample."
    );
  });

  it.each([undefined, "text/plain"])("rejects unsupported content type %j", async (contentType) => {
    await expectInvalid(
      rawRequest("fixture", contentType),
      "Upload a zip file or send JSON with a githubUrl."
    );
  });
});

describe("POST /api/analyze capacity boundary", () => {
  it("stops before acquiring a slot when the client is rate limited", async () => {
    mocks.checkRateLimit.mockResolvedValueOnce({
      allowed: false,
      bestEffort: true,
      retryAfterMs: 1_500,
    });

    const response = await POST(jsonRequest({ sample: true }));

    expect(response.status).toBe(429);
    expect(response.headers.get("retry-after")).toBe("2");
    expect(mocks.clientKeyFromHeaders).toHaveBeenCalledOnce();
    expect(mocks.tryAcquireAnalysisSlot).not.toHaveBeenCalled();
    expect(mocks.releaseSlot).not.toHaveBeenCalled();
  });

  it("uses the default wait when the rate limiter omits retry timing", async () => {
    mocks.checkRateLimit.mockResolvedValueOnce({ allowed: false, bestEffort: true });

    const response = await POST(jsonRequest({ sample: true }));

    expect(response.headers.get("retry-after")).toBe("60");
  });

  it("returns busy before parsing when no analysis slot is available", async () => {
    mocks.tryAcquireAnalysisSlot.mockReturnValueOnce(null);

    const response = await POST(jsonRequest({ sample: true }));

    expect(response.status).toBe(429);
    expect(response.headers.get("retry-after")).toBe("10");
    await expect(response.json()).resolves.toMatchObject({
      code: ERROR_CODES.RATE_LIMIT_EXCEEDED,
      message: "Server is busy (max 4 concurrent analyses). Please retry shortly.",
      requestId: expect.any(String),
    });
    expect(mocks.analyzeRepository).not.toHaveBeenCalled();
    expect(mocks.releaseSlot).not.toHaveBeenCalled();
  });
});

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
  for (const failure of failures) {
    it(`returns a bounded response for ${failure.label}`, async () => {
      mocks.analyzeRepository.mockRejectedValueOnce(
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

      const response = await POST(
        jsonRequest({
          githubUrl: "https://github.com/private-owner/private-repository",
          ref: "private-ref-name",
        })
      );
      const body = await response.json();

      expect(response.status).toBe(failure.status);
      expect(body.code).toBe(failure.code);
      expect(body.message).toBeTruthy();
      expect(body.requestId).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
      );
      expect(mocks.analyzeRepository).toHaveBeenCalledWith(
        expect.objectContaining({ kind: "github" }),
        expect.objectContaining({ requestId: body.requestId })
      );
      if (failure.code === ERROR_CODES.RATE_LIMITED) {
        expect(response.headers.get("retry-after")).toBe("60");
      }

      expect(mocks.releaseSlot).toHaveBeenCalledOnce();
      expect(consoleError).toHaveBeenCalledOnce();
      const logLine = String(consoleError.mock.calls[0]?.[0]);
      expect(logLine).toContain(failure.code);
      expect(logLine).not.toMatch(
        /private-owner|private-repository|private-ref-name|private-report-token|private upstream detail/
      );
    });
  }
});
