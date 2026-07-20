import { describe, expect, it } from "vitest";
import {
  MAX_PNG_CANVAS_DIMENSION,
  describeMarkdownExportFailure,
  fitExportCanvasScale,
} from "./ReportTabs";

describe("ReportTabs markdown export messaging", () => {
  it("formats a failed markdown export with route context and API taxonomy", () => {
    const message = describeMarkdownExportFailure(
      { code: "ANALYSIS_FAILED", message: "Analysis failed. Check server logs." },
      503
    );

    expect(message).not.toContain("rpt_123");
    expect(message).toContain("HTTP 503");
    expect(message).toContain("ANALYSIS_FAILED");
  });

  it("formats a successful-path API payload without degrading copy", () => {
    const message = describeMarkdownExportFailure(
      { message: "Analysis failed. Check server logs." },
      500
    );

    expect(message).toContain("Analysis failed. Check server logs.");
  });
});

describe("ReportTabs PNG canvas sizing", () => {
  it("keeps the requested scale for reports within the browser canvas limit", () => {
    expect(fitExportCanvasScale(1_100, 10_000, 1.5)).toBe(1.5);
  });

  it("reduces long reports below the browser canvas dimension limit", () => {
    const scale = fitExportCanvasScale(1_036, 45_220, 1.5);

    expect(Math.ceil(45_220 * scale)).toBeLessThanOrEqual(MAX_PNG_CANVAS_DIMENSION);
    expect(Math.ceil(1_036 * scale)).toBeLessThanOrEqual(MAX_PNG_CANVAS_DIMENSION);
  });
});
