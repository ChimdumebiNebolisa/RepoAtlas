import { describe, expect, it } from "vitest";
import { formatReportFetchError } from "./InputForm";

describe("InputForm error messaging", () => {
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
