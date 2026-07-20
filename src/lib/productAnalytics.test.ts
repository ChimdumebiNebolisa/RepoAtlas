import { describe, expect, it, vi } from "vitest";

const posthog = vi.hoisted(() => ({
  capture: vi.fn(),
  init: vi.fn(),
}));

vi.mock("posthog-js", () => ({ default: posthog }));

import {
  analysisEntrySource,
  captureAnalysisEvent,
  captureReportExportFailure,
  captureReportShared,
  initializeProductAnalytics,
  stableRouteName,
} from "./productAnalytics";

describe("stableRouteName", () => {
  it("keeps report and share identifiers out of analytics properties", () => {
    expect(stableRouteName("/report/1a2b3c")).toBe("report");
    expect(stableRouteName("/share/secret-token")).toBe("shared_report");
  });

  it("names known static routes without recording arbitrary paths", () => {
    expect(stableRouteName("/")).toBe("home");
    expect(stableRouteName("/interview-preparation")).toBe("interview_preparation");
    expect(stableRouteName("/pricing")).toBe("pricing");
    expect(stableRouteName("/unexpected/private-value")).toBe("other");
  });
});

describe("analysisEntrySource", () => {
  it("keeps only the bounded interview-preparation and Cycle 3 sources", () => {
    expect(analysisEntrySource("?source=interview_preparation")).toBe("interview_preparation");
    expect(analysisEntrySource("?source=c3p1")).toBe("c3p1");
    expect(analysisEntrySource("?source=c3p2")).toBe("c3p2");
    expect(analysisEntrySource("?source=private-repository-name")).toBeUndefined();
    expect(analysisEntrySource("?source=c3p3")).toBeUndefined();
    expect(analysisEntrySource("")).toBeUndefined();
  });
});

describe("captureAnalysisEvent", () => {
  it("records only the bounded input type for start and completion", () => {
    vi.stubGlobal("window", {});
    initializeProductAnalytics();

    expect(posthog.init).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        disable_capture_url_hashes: true,
        property_denylist: expect.arrayContaining([
          "$current_url",
          "$pathname",
          "$initial_current_url",
          "$session_entry_url",
        ]),
        save_referrer: false,
      })
    );

    captureAnalysisEvent("analysis_started", "github", "planned_change");
    captureAnalysisEvent("analysis_completed", "sample", "bug");

    expect(posthog.capture).toHaveBeenNthCalledWith(1, "analysis_started", {
      input_type: "github",
      analysis_intent: "planned_change",
    });
    expect(posthog.capture).toHaveBeenNthCalledWith(2, "analysis_completed", {
      input_type: "sample",
      analysis_intent: "bug",
    });
  });
});

describe("captureReportShared", () => {
  it("records only bounded delivery and link types", () => {
    captureReportShared("clipboard", "portable_link");

    expect(posthog.capture).toHaveBeenLastCalledWith("report_shared", {
      share_method: "clipboard",
      share_type: "portable_link",
    });
  });
});

describe("captureReportExportFailure", () => {
  it("records only bounded export diagnostics", () => {
    captureReportExportFailure("markdown", "live", "http_error", 503);

    expect(posthog.capture).toHaveBeenLastCalledWith("report_export_failed", {
      format: "markdown",
      report_variant: "live",
      failure_class: "http_error",
      status: 503,
    });
  });
});
