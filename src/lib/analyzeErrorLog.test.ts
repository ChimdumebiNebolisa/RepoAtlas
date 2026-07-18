import { describe, expect, it } from "vitest";
import { analyzeErrorLogPayload } from "./analyzeErrorLog";
import { AppError, ERROR_CODES } from "./errors";

describe("analyzeErrorLogPayload", () => {
  it("keeps repository inputs, refs, tokens, paths, and raw causes out of logs", () => {
    const err = new AppError({
      code: ERROR_CODES.MISSING_REF,
      status: 404,
      message: "Missing private-ref-name",
      meta: {
        status: 404,
        githubUrl: "https://github.com/private-owner/private-repo",
        ref: "private-ref-name",
        zipRef: "/tmp/private-repo.zip",
        reportId: "private-report-token",
        rawMessage: "upstream leaked private-owner/private-repo",
      },
      cause: new Error("token=private-secret"),
    });

    const payload = analyzeErrorLogPayload("safe-request-id", err);
    const serialized = JSON.stringify(payload);

    expect(payload).toEqual({
      level: "error",
      requestId: "safe-request-id",
      code: "MISSING_REF",
      status: 404,
      upstreamStatus: 404,
    });
    expect(serialized).not.toMatch(
      /private-owner|private-repo|private-ref-name|private-report-token|private-secret|zipRef/
    );
  });

  it("retains bounded status and byte-count diagnostics", () => {
    const err = new AppError({
      code: ERROR_CODES.REPO_TOO_LARGE,
      status: 413,
      message: "Oversized archive",
      meta: { status: 200, contentLength: 104_857_601 },
    });

    expect(analyzeErrorLogPayload("request-id", err)).toEqual({
      level: "error",
      requestId: "request-id",
      code: "REPO_TOO_LARGE",
      status: 413,
      upstreamStatus: 200,
      contentLength: 104_857_601,
    });
  });
});
