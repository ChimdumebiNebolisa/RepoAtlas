import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const posthog = vi.hoisted(() => ({
  capture: vi.fn(),
  init: vi.fn(),
}));

vi.mock("posthog-js", () => ({ default: posthog }));

type AnalyticsModule = typeof import("./productAnalytics");

async function loadAnalytics(browser = true): Promise<AnalyticsModule> {
  if (browser) vi.stubGlobal("window", {});
  return import("./productAnalytics");
}

async function loadInitializedAnalytics(): Promise<AnalyticsModule> {
  const analytics = await loadAnalytics();
  analytics.initializeProductAnalytics();
  return analytics;
}

beforeEach(() => {
  vi.resetModules();
  posthog.capture.mockReset();
  posthog.init.mockReset();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("initialization", () => {
  it("does nothing during server rendering", async () => {
    const analytics = await loadAnalytics(false);

    analytics.initializeProductAnalytics();

    expect(posthog.init).not.toHaveBeenCalled();
  });

  it("initializes once with every privacy control enabled", async () => {
    const analytics = await loadAnalytics();

    analytics.initializeProductAnalytics();
    analytics.initializeProductAnalytics();

    expect(posthog.init).toHaveBeenCalledTimes(1);
    expect(posthog.init).toHaveBeenCalledWith(expect.any(String), {
      api_host: "https://us.i.posthog.com",
      defaults: "2025-05-24",
      autocapture: false,
      capture_pageview: false,
      capture_pageleave: false,
      capture_exceptions: false,
      disable_capture_url_hashes: true,
      disable_session_recording: true,
      person_profiles: "identified_only",
      property_denylist: [
        "$current_url",
        "$pathname",
        "$initial_current_url",
        "$session_entry_url",
        "$referrer",
        "$initial_referrer",
      ],
      save_referrer: false,
    });
  });

  it("drops events captured before initialization", async () => {
    const analytics = await loadAnalytics();

    analytics.captureProductEvent("report_viewed", {
      report_variant: "live",
    });

    expect(posthog.capture).not.toHaveBeenCalled();
  });
});

describe("stableRouteName", () => {
  it("maps only stable routes and never records dynamic paths", async () => {
    const { stableRouteName } = await loadAnalytics(false);

    expect(stableRouteName("/")).toBe("home");
    expect(stableRouteName("/interview-preparation")).toBe(
      "interview_preparation"
    );
    expect(stableRouteName("/pricing")).toBe("pricing");
    expect(stableRouteName("/report/1a2b3c")).toBe("report");
    expect(stableRouteName("/share/secret-token")).toBe("shared_report");
    expect(stableRouteName("/unexpected/private-value")).toBe("other");
  });
});

describe("analysisEntrySource", () => {
  it("keeps only the bounded interview-preparation and Cycle 3 sources", async () => {
    const { analysisEntrySource } = await loadAnalytics(false);

    expect(analysisEntrySource("?source=interview_preparation")).toBe(
      "interview_preparation"
    );
    expect(analysisEntrySource("?source=c3p1")).toBe("c3p1");
    expect(analysisEntrySource("?source=c3p2")).toBe("c3p2");
    expect(
      analysisEntrySource("?source=private-repository-name")
    ).toBeUndefined();
    expect(analysisEntrySource("?source=c3p3")).toBeUndefined();
    expect(analysisEntrySource("")).toBeUndefined();
  });
});

describe("event-specific property allowlists", () => {
  it("captures every stable route and rejects an unbounded route", async () => {
    const analytics = await loadInitializedAnalytics();
    const routes = [
      "home",
      "interview_preparation",
      "pricing",
      "report",
      "shared_report",
      "other",
    ] as const;

    for (const route_name of routes) {
      analytics.captureProductEvent("route_viewed", { route_name });
    }
    analytics.captureProductEvent("route_viewed", {
      route_name: "/report/private-id",
    } as never);

    expect(posthog.capture).toHaveBeenCalledTimes(routes.length);
    expect(posthog.capture).toHaveBeenLastCalledWith("route_viewed", {
      route_name: "other",
    });
  });

  it("captures only the fixed CTA shape and bounded optional source", async () => {
    const analytics = await loadInitializedAnalytics();

    for (const entry_source of [
      "interview_preparation",
      "c3p1",
      "c3p2",
    ] as const) {
      analytics.captureProductEvent("analysis_cta_clicked", {
        source: "interview_preparation",
        destination: "analysis_start",
        entry_source,
      });
    }
    analytics.captureProductEvent("analysis_cta_clicked", {
      source: "interview_preparation",
      destination: "analysis_start",
      entry_source: "private-repository",
    } as never);
    analytics.captureProductEvent("analysis_cta_clicked", {
      source: "homepage",
      destination: "analysis_start",
    } as never);

    expect(posthog.capture).toHaveBeenCalledTimes(4);
    expect(posthog.capture).toHaveBeenNthCalledWith(
      4,
      "analysis_cta_clicked",
      {
        source: "interview_preparation",
        destination: "analysis_start",
      }
    );
  });

  it("accepts each analysis input and intent for start and completion", async () => {
    const analytics = await loadInitializedAnalytics();
    const inputs = ["zip", "github", "sample"] as const;
    const intents = [
      "interview",
      "bug",
      "planned_change",
      "pull_request",
    ] as const;

    inputs.forEach((input_type, index) => {
      analytics.captureProductEvent("analysis_started", {
        input_type,
        analysis_intent: intents[index],
      });
      analytics.captureProductEvent("analysis_completed", {
        input_type,
        analysis_intent: intents[index + 1],
        entry_source: "c3p1",
      });
    });
    analytics.captureProductEvent("analysis_started", {
      input_type: "repository-name",
      analysis_intent: "interview",
    } as never);
    analytics.captureProductEvent("analysis_completed", {
      input_type: "sample",
      analysis_intent: "unknown",
    } as never);

    expect(posthog.capture).toHaveBeenCalledTimes(6);
  });

  it("bounds every optional analysis failure diagnostic", async () => {
    const analytics = await loadInitializedAnalytics();
    const stages = [
      "analysis",
      "analysis_response",
      "report_load",
      "network",
    ] as const;

    stages.forEach((stage, index) => {
      analytics.captureProductEvent("analysis_failed", {
        input_type: "github",
        analysis_intent: "bug",
        stage,
        status_code: 400 + index,
        error_code: index === 0 ? "INVALID_INPUT" : "NETWORK_ERROR",
      });
    });
    analytics.captureProductEvent("analysis_failed", {
      input_type: "zip",
      analysis_intent: "planned_change",
      entry_source: "private-source",
      stage: "private-stage",
      status_code: 200,
      error_code: "raw server message",
    } as never);
    analytics.captureProductEvent("analysis_failed", {
      input_type: "sample",
      analysis_intent: "interview",
      status_code: 599.5,
      error_code: "INVALID_REPORT_ID",
    } as never);
    analytics.captureProductEvent("analysis_failed", {
      input_type: "private",
      analysis_intent: "interview",
    } as never);

    expect(posthog.capture).toHaveBeenCalledTimes(6);
    expect(posthog.capture).toHaveBeenNthCalledWith(5, "analysis_failed", {
      input_type: "zip",
      analysis_intent: "planned_change",
    });
    expect(posthog.capture).toHaveBeenNthCalledWith(6, "analysis_failed", {
      input_type: "sample",
      analysis_intent: "interview",
      error_code: "INVALID_REPORT_ID",
    });
  });

  it("accepts all export formats and report variants", async () => {
    const analytics = await loadInitializedAnalytics();
    const formats = ["pdf", "png", "markdown"] as const;
    const variants = ["live", "preview", "shared"] as const;

    formats.forEach((format, index) => {
      analytics.captureProductEvent("report_exported", {
        format,
        report_variant: variants[index],
      });
    });
    analytics.captureProductEvent("report_exported", {
      format: "repository.zip",
      report_variant: "live",
    } as never);
    analytics.captureProductEvent("report_exported", {
      format: "pdf",
      report_variant: "private-report",
    } as never);

    expect(posthog.capture).toHaveBeenCalledTimes(3);
  });

  it("bounds export failures, their classes, and HTTP statuses", async () => {
    const analytics = await loadInitializedAnalytics();
    const failureClasses = [
      "render_failed",
      "http_error",
      "request_failed",
    ] as const;

    failureClasses.forEach((failure_class, index) => {
      analytics.captureProductEvent("report_export_failed", {
        format: index === 0 ? "pdf" : index === 1 ? "png" : "markdown",
        report_variant: index === 0 ? "live" : index === 1 ? "preview" : "shared",
        failure_class,
        status: 400 + index,
      });
    });
    analytics.captureProductEvent("report_export_failed", {
      format: "pdf",
      report_variant: "live",
      failure_class: "http_error",
      status: 600,
    } as never);
    analytics.captureProductEvent("report_export_failed", {
      format: "pdf",
      report_variant: "live",
      failure_class: "raw-message",
    } as never);

    expect(posthog.capture).toHaveBeenCalledTimes(4);
    expect(posthog.capture).toHaveBeenNthCalledWith(
      4,
      "report_export_failed",
      {
        format: "pdf",
        report_variant: "live",
        failure_class: "http_error",
      }
    );
  });

  it("accepts every bounded sharing pair and rejects unknown values", async () => {
    const analytics = await loadInitializedAnalytics();

    analytics.captureProductEvent("report_shared", {
      share_method: "native",
      share_type: "stored_link",
    });
    analytics.captureProductEvent("report_shared", {
      share_method: "clipboard",
      share_type: "portable_link",
    });
    analytics.captureProductEvent("report_shared", {
      share_method: "email",
      share_type: "portable_link",
    } as never);
    analytics.captureProductEvent("report_shared", {
      share_method: "clipboard",
      share_type: "repository_url",
    } as never);

    expect(posthog.capture).toHaveBeenCalledTimes(2);
  });

  it("accepts every report-view and walkthrough format combination", async () => {
    const analytics = await loadInitializedAnalytics();
    const variants = ["live", "preview", "shared"] as const;

    variants.forEach((report_variant) => {
      analytics.captureProductEvent("report_viewed", { report_variant });
      analytics.captureProductEvent("walkthrough_copied", {
        report_variant,
        format: "30_second",
      });
      analytics.captureProductEvent("walkthrough_copied", {
        report_variant,
        format: "2_minute",
      });
    });
    analytics.captureProductEvent("report_viewed", {
      report_variant: "private-id",
    } as never);
    analytics.captureProductEvent("walkthrough_copied", {
      report_variant: "live",
      format: "full-report",
    } as never);

    expect(posthog.capture).toHaveBeenCalledTimes(9);
  });

  it("drops extra properties even when required values are valid", async () => {
    const analytics = await loadInitializedAnalytics();

    analytics.captureProductEvent("report_exported", {
      format: "pdf",
      report_variant: "live",
      repository_url: "https://github.com/private/repository",
      report_id: "private-report-id",
      raw_timing: 9123,
    } as never);

    expect(posthog.capture).toHaveBeenCalledWith("report_exported", {
      format: "pdf",
      report_variant: "live",
    });
  });

  it("drops unknown event names at the shared boundary", async () => {
    const analytics = await loadInitializedAnalytics();

    analytics.captureProductEvent("private_event" as never, {
      repository_url: "https://github.com/private/repository",
    } as never);

    expect(posthog.capture).not.toHaveBeenCalled();
  });
});

describe("public capture helpers", () => {
  it("routes analysis events through the shared allowlist", async () => {
    const analytics = await loadInitializedAnalytics();

    analytics.captureAnalysisEvent(
      "analysis_failed",
      "github",
      "pull_request",
      {
        entry_source: "c3p2",
        stage: "analysis_response",
        status_code: 504,
        error_code: "TIMEOUT",
      }
    );

    expect(posthog.capture).toHaveBeenCalledWith("analysis_failed", {
      input_type: "github",
      analysis_intent: "pull_request",
      entry_source: "c3p2",
      stage: "analysis_response",
      status_code: 504,
      error_code: "TIMEOUT",
    });
  });

  it("routes report sharing, viewing, and both walkthrough copies", async () => {
    const analytics = await loadInitializedAnalytics();

    analytics.captureReportShared("clipboard", "portable_link");
    analytics.captureReportViewed("shared");
    analytics.captureWalkthroughCopied("preview", "30_second");
    analytics.captureWalkthroughCopied("live", "2_minute");

    expect(posthog.capture).toHaveBeenNthCalledWith(1, "report_shared", {
      share_method: "clipboard",
      share_type: "portable_link",
    });
    expect(posthog.capture).toHaveBeenNthCalledWith(2, "report_viewed", {
      report_variant: "shared",
    });
    expect(posthog.capture).toHaveBeenNthCalledWith(3, "walkthrough_copied", {
      report_variant: "preview",
      format: "30_second",
    });
    expect(posthog.capture).toHaveBeenNthCalledWith(4, "walkthrough_copied", {
      report_variant: "live",
      format: "2_minute",
    });
  });

  it("routes export failures with and without a bounded status", async () => {
    const analytics = await loadInitializedAnalytics();

    analytics.captureReportExportFailure(
      "markdown",
      "live",
      "http_error",
      503
    );
    analytics.captureReportExportFailure(
      "png",
      "preview",
      "render_failed"
    );

    expect(posthog.capture).toHaveBeenNthCalledWith(
      1,
      "report_export_failed",
      {
        format: "markdown",
        report_variant: "live",
        failure_class: "http_error",
        status: 503,
      }
    );
    expect(posthog.capture).toHaveBeenNthCalledWith(
      2,
      "report_export_failed",
      {
        format: "png",
        report_variant: "preview",
        failure_class: "render_failed",
      }
    );
  });
});
