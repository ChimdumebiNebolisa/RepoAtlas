import { describe, expect, it, vi } from "vitest";

const posthog = vi.hoisted(() => ({
  capture: vi.fn(),
  init: vi.fn(),
}));

vi.mock("posthog-js", () => ({ default: posthog }));

import {
  captureAnalysisEvent,
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
    expect(stableRouteName("/pricing")).toBe("pricing");
    expect(stableRouteName("/unexpected/private-value")).toBe("other");
  });
});

describe("captureAnalysisEvent", () => {
  it("records only the bounded input type for start and completion", () => {
    vi.stubGlobal("window", {});
    initializeProductAnalytics();

    captureAnalysisEvent("analysis_started", "github");
    captureAnalysisEvent("analysis_completed", "sample");

    expect(posthog.capture).toHaveBeenNthCalledWith(1, "analysis_started", {
      input_type: "github",
    });
    expect(posthog.capture).toHaveBeenNthCalledWith(2, "analysis_completed", {
      input_type: "sample",
    });
  });
});
