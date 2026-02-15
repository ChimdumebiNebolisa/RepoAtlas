import { describe, it, expect } from "vitest";
import {
  AppError,
  ERROR_CODES,
  isAppError,
  toAppError,
  toApiErrorPayload,
} from "./errors";

describe("AppError", () => {
  it("creates error with code, status, and message", () => {
    const err = new AppError({
      code: ERROR_CODES.INVALID_URL,
      status: 400,
      message: "Invalid GitHub URL",
    });
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(AppError);
    expect(err.code).toBe("INVALID_URL");
    expect(err.status).toBe(400);
    expect(err.message).toBe("Invalid GitHub URL");
    expect(err.expose).toBe(true);
  });

  it("defaults expose to true", () => {
    const err = new AppError({
      code: ERROR_CODES.CLONE_FAILED,
      status: 502,
      message: "Clone failed",
    });
    expect(err.expose).toBe(true);
  });

  it("accepts meta and cause", () => {
    const cause = new Error("inner");
    const err = new AppError({
      code: ERROR_CODES.REPO_NOT_PUBLIC,
      status: 403,
      message: "Private repo",
      meta: { rawMessage: "fatal: not found" },
      cause,
    });
    expect(err.meta).toEqual({ rawMessage: "fatal: not found" });
    expect(err.cause).toBe(cause);
  });
});

describe("isAppError", () => {
  it("returns true for AppError", () => {
    const err = new AppError({
      code: ERROR_CODES.TIMEOUT,
      status: 504,
      message: "Timeout",
    });
    expect(isAppError(err)).toBe(true);
  });

  it("returns false for plain Error", () => {
    expect(isAppError(new Error("foo"))).toBe(false);
  });

  it("returns false for non-error", () => {
    expect(isAppError(null)).toBe(false);
    expect(isAppError("string")).toBe(false);
  });
});

describe("toAppError", () => {
  it("returns same error when given AppError", () => {
    const appErr = new AppError({
      code: ERROR_CODES.ZIP_NOT_FOUND,
      status: 404,
      message: "Not found",
    });
    expect(toAppError(appErr)).toBe(appErr);
  });

  it("wraps plain Error as ANALYSIS_FAILED with expose false", () => {
    const plain = new Error("internal detail");
    const appErr = toAppError(plain);
    expect(appErr.code).toBe(ERROR_CODES.ANALYSIS_FAILED);
    expect(appErr.status).toBe(500);
    expect(appErr.message).toBe("Analysis failed. Check server logs.");
    expect(appErr.expose).toBe(false);
    expect(appErr.meta?.rawMessage).toBe("internal detail");
    expect(appErr.cause).toBe(plain);
  });

  it("wraps non-Error as ANALYSIS_FAILED", () => {
    const appErr = toAppError("something broke");
    expect(appErr.code).toBe(ERROR_CODES.ANALYSIS_FAILED);
    expect(appErr.status).toBe(500);
    expect(appErr.meta?.rawMessage).toBe("Unknown error");
  });
});

describe("toApiErrorPayload", () => {
  it("returns specific status, code, and user message for known AppErrors", () => {
    const err = new AppError({
      code: ERROR_CODES.REPO_NOT_PUBLIC,
      status: 403,
      message: "Private repo",
    });
    const payload = toApiErrorPayload(err);
    expect(payload).toEqual({
      status: 403,
      code: "REPO_NOT_PUBLIC",
      message:
        "Repository is private or not found. RepoAtlas only analyzes public GitHub repos.",
    });
  });

  it("returns REPO_TOO_LARGE with 413 and specific message", () => {
    const err = new AppError({
      code: ERROR_CODES.REPO_TOO_LARGE,
      status: 413,
      message: "Too large",
    });
    const payload = toApiErrorPayload(err);
    expect(payload.status).toBe(413);
    expect(payload.code).toBe("REPO_TOO_LARGE");
    expect(payload.message).toContain("100MB");
  });

  it("returns TIMEOUT with 504 and specific message", () => {
    const err = new AppError({
      code: ERROR_CODES.TIMEOUT,
      status: 504,
      message: "Timed out",
    });
    const payload = toApiErrorPayload(err);
    expect(payload.status).toBe(504);
    expect(payload.code).toBe("TIMEOUT");
    expect(payload.message).toContain("timed out");
  });

  it("returns CLONE_TIMEOUT with 504 and specific message", () => {
    const err = new AppError({
      code: ERROR_CODES.CLONE_TIMEOUT,
      status: 504,
      message: "Clone timed out",
    });
    const payload = toApiErrorPayload(err);
    expect(payload.status).toBe(504);
    expect(payload.code).toBe("CLONE_TIMEOUT");
    expect(payload.message).toContain("Cloning");
  });

  it("returns ZIP_NOT_FOUND with 404 and specific message", () => {
    const err = new AppError({
      code: ERROR_CODES.ZIP_NOT_FOUND,
      status: 404,
      message: "Zip path not found",
    });
    const payload = toApiErrorPayload(err);
    expect(payload.status).toBe(404);
    expect(payload.code).toBe("ZIP_NOT_FOUND");
    expect(payload.message).toContain("not found");
  });

  it("returns sanitized message for unknown Error (ANALYSIS_FAILED)", () => {
    const plain = new Error("sensitive internal detail");
    const payload = toApiErrorPayload(plain);
    expect(payload.status).toBe(500);
    expect(payload.code).toBe("ANALYSIS_FAILED");
    expect(payload.message).toBe("Analysis failed. Check server logs.");
    expect(payload.message).not.toContain("sensitive");
  });
});
