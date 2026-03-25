import { describe, expect, it } from "vitest";
import { describeMarkdownExportFailure } from "./ReportTabs";

describe("ReportTabs markdown export messaging", () => {
  it("formats a failed markdown export with route context and API taxonomy", () => {
    const message = describeMarkdownExportFailure(
      { code: "ANALYSIS_FAILED", message: "Analysis failed. Check server logs." },
      503,
      "rpt_123"
    );

    expect(message).toContain("rpt_123");
    expect(message).toContain("HTTP 503");
    expect(message).toContain("ANALYSIS_FAILED");
  });

  it("formats a successful-path API payload without degrading copy", () => {
    const message = describeMarkdownExportFailure(
      { message: "Analysis failed. Check server logs." },
      500,
      "rpt_456"
    );

    expect(message).toContain("Analysis failed. Check server logs.");
  });
});
