import { describe, expect, it } from "vitest";
import { formatApiError, formatReportFetchError } from "./InputForm";

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
});
