import { describe, expect, it } from "vitest";
import {
  formatApiError,
  formatReportFetchError,
  isValidReportId,
  validateGithubInput,
} from "./InputForm";

describe("InputForm error messaging", () => {
  it("shows the bounded wait before retrying a rate-limited analysis", () => {
    expect(
      formatApiError(
        { code: "RATE_LIMITED", message: "GitHub rate limit reached." },
        "Analysis failed.",
        "60"
      )
    ).toBe("RATE_LIMITED: GitHub rate limit reached. Retry in 60 seconds.");
  });

  it("includes report id and API taxonomy details for failed report fetch", () => {
    const message = formatReportFetchError(
      { code: "ANALYSIS_FAILED", message: "Analysis failed. Check server logs." },
      500,
      "rpt_abc123"
    );

    expect(message).toContain("rpt_abc123");
    expect(message).toContain("HTTP 500");
    expect(message).toContain("ANALYSIS_FAILED");
    expect(message).toContain("Analysis failed. Check server logs.");
  });

  it("falls back safely when the API response has no bounded error", () => {
    expect(formatApiError(null, "Analysis failed.")).toBe("Analysis failed.");
    expect(formatApiError({ code: "ANALYSIS_FAILED" }, "Analysis failed.")).toBe(
      "ANALYSIS_FAILED"
    );
  });

  it("validates canonical GitHub URLs and optional refs", () => {
    expect(validateGithubInput("https://example.com/owner/repository", "")).toBe(
      "Enter a canonical URL like https://github.com/owner/repository."
    );
    expect(validateGithubInput("https://github.com/owner/repository", "bad ref")).toBe(
      "Enter a valid branch or tag name (letters, numbers, ., _, -, /)."
    );
    expect(validateGithubInput("https://github.com/owner/repository", "main")).toBeNull();
  });

  it("accepts only UUID-shaped report identifiers", () => {
    expect(isValidReportId("00000000-0000-4000-8000-000000000000")).toBe(true);
    expect(isValidReportId("report-123")).toBe(false);
    expect(isValidReportId(null)).toBe(false);
  });
});
