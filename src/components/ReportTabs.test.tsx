import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { buildSampleReport } from "@/lib/buildSampleReport";
import { ReportTabs } from "./ReportTabs";

const createPortableShareLink = vi.hoisted(() => vi.fn());
const captureReportShared = vi.hoisted(() => vi.fn());
const captureReportViewed = vi.hoisted(() => vi.fn());
const layoutGraph = vi.hoisted(() => vi.fn());
const html2canvas = vi.hoisted(() => vi.fn());

function deferred<T>() {
  let reject!: (reason?: unknown) => void;
  let resolve!: (value: T | PromiseLike<T>) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    reject = rejectPromise;
    resolve = resolvePromise;
  });
  return { promise, reject, resolve };
}

vi.mock("@/lib/portableSharing", () => ({ createPortableShareLink }));
vi.mock("@/lib/elkLayout", () => ({ layoutGraph }));
vi.mock("html2canvas", () => ({ default: html2canvas }));
vi.mock("./CandidateBriefPanel", () => ({
  CandidateBriefPanel: ({
    candidateBrief,
  }: {
    candidateBrief?: unknown;
  }) => (
    <div>
      {candidateBrief
        ? "Candidate Brief content"
        : "Candidate Brief is not available for this report."}
    </div>
  ),
}));
vi.mock("./ReportOverview", () => ({
  ReportOverview: () => <div>Overview content</div>,
}));
vi.mock("./FolderMapTree", () => ({
  FolderMapTree: () => <div>Folder Map content</div>,
}));
vi.mock("./StartHereTable", () => ({
  StartHereTable: () => <div>Start Here content</div>,
}));
vi.mock("./DangerZonesTable", () => ({
  DangerZonesTable: () => <div>Danger Zones content</div>,
}));
vi.mock("./RunContributeSection", () => ({
  RunContributeSection: () => <div>Run &amp; Contribute content</div>,
}));
vi.mock("@/lib/productAnalytics", () => ({
  captureProductEvent: vi.fn(),
  captureReportExportFailure: vi.fn(),
  captureReportShared,
  captureReportViewed,
}));

beforeEach(() => {
  createPortableShareLink.mockReset();
  captureReportShared.mockReset();
  captureReportViewed.mockReset();
  layoutGraph.mockReset();
  html2canvas.mockReset();
  Element.prototype.scrollIntoView = vi.fn();
  layoutGraph.mockResolvedValue({
    nodes: [
      { id: "InputForm", label: "InputForm", x: 0, y: 0, width: 100, height: 40 },
      {
        id: "AnalyzeRoute",
        label: "/api/analyze route",
        x: 0,
        y: 120,
        width: 160,
        height: 40,
      },
    ],
    edges: [
      {
        from: "InputForm",
        to: "AnalyzeRoute",
        path: [
          { x: 50, y: 40 },
          { x: 80, y: 120 },
        ],
      },
    ],
    width: 200,
    height: 200,
  });
  vi.stubGlobal(
    "IntersectionObserver",
    class MockIntersectionObserver {
      private callback: IntersectionObserverCallback;

      constructor(callback: IntersectionObserverCallback) {
        this.callback = callback;
      }

      observe(target: Element) {
        this.callback(
          [{ isIntersecting: true, target } as IntersectionObserverEntry],
          this as unknown as IntersectionObserver
        );
      }

      disconnect() {}
      unobserve() {}
      takeRecords() { return []; }
      root = null;
      rootMargin = "0px";
      thresholds = [0];
    }
  );
  vi.stubGlobal(
    "ResizeObserver",
    class MockResizeObserver {
      observe() {}
      disconnect() {}
      unobserve() {}
    }
  );
  Object.defineProperty(window.navigator, "share", {
    configurable: true,
    value: undefined,
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  cleanup();
});

describe("ReportTabs walkthrough analytics", () => {
  it.each(["live", "preview", "shared"] as const)(
    "counts the Candidate Brief viewport once for the %s variant",
    (variant) => {
      const report = buildSampleReport();
      const { rerender } = render(<ReportTabs report={report} variant={variant} />);

      expect(captureReportViewed).toHaveBeenCalledTimes(1);
      expect(captureReportViewed).toHaveBeenCalledWith(variant);
      if (variant === "live") {
        expect(screen.getByRole("button", { name: "Share Candidate Brief" })).toBeEnabled();
      } else {
        expect(screen.queryByRole("button", { name: "Share Candidate Brief" })).toBeNull();
      }

      rerender(<ReportTabs report={report} variant={variant} />);
      expect(captureReportViewed).toHaveBeenCalledTimes(1);
    }
  );

  it("returns a replacement report to its Candidate Brief and counts the new view", async () => {
    const user = userEvent.setup();
    const firstReport = buildSampleReport();
    const replacementReport = {
      ...buildSampleReport(),
      repo_metadata: {
        ...buildSampleReport().repo_metadata,
        name: "replacement-report",
        clone_hash: "replacement",
      },
    };
    const { rerender } = render(<ReportTabs report={firstReport} />);

    await user.click(screen.getByRole("tab", { name: "Overview" }));
    expect(screen.getByRole("tab", { name: "Overview" })).toHaveAttribute(
      "aria-selected",
      "true"
    );

    rerender(<ReportTabs report={replacementReport} />);

    await waitFor(() =>
      expect(screen.getByRole("tab", { name: "Candidate Brief" })).toHaveAttribute(
        "aria-selected",
        "true"
      )
    );
    expect(captureReportViewed).toHaveBeenCalledTimes(2);
  });

  it("does not count a report without a Candidate Brief", () => {
    const report = {
      ...buildSampleReport(),
      analysis_intent: "bug" as const,
      repo_metadata: {
        ...buildSampleReport().repo_metadata,
        clone_hash: null,
      },
      candidate_brief: undefined,
    };

    render(<ReportTabs report={report} />);

    expect(
      screen.getByText(/Candidate Brief is not available for this report/i)
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Share Candidate Brief" })).toBeNull();
    expect(captureReportViewed).not.toHaveBeenCalled();
  });

  it("leaves analytics silent when IntersectionObserver is unavailable", () => {
    vi.stubGlobal("IntersectionObserver", undefined);

    render(<ReportTabs report={buildSampleReport()} />);

    expect(captureReportViewed).not.toHaveBeenCalled();
  });

  it("ignores a non-intersecting Candidate Brief and disconnects on cleanup", () => {
    let callback: IntersectionObserverCallback | null = null;
    const observe = vi.fn();
    const disconnect = vi.fn();
    vi.stubGlobal(
      "IntersectionObserver",
      class MockIntersectionObserver {
        constructor(nextCallback: IntersectionObserverCallback) {
          callback = nextCallback;
        }

        observe = observe;
        disconnect = disconnect;
        unobserve() {}
        takeRecords() { return []; }
        root = null;
        rootMargin = "0px";
        thresholds = [0];
      }
    );

    const { unmount } = render(<ReportTabs report={buildSampleReport()} />);
    expect(observe).toHaveBeenCalledTimes(1);

    act(() => {
      callback?.(
        [{ isIntersecting: false } as IntersectionObserverEntry],
        {} as IntersectionObserver
      );
    });
    expect(captureReportViewed).not.toHaveBeenCalled();

    unmount();
    expect(disconnect).toHaveBeenCalledTimes(1);
  });

  it("clears share recovery from a replaced report", async () => {
    createPortableShareLink.mockRejectedValueOnce(
      new Error(
        "This brief is too large for a private link. Export PDF to share it instead."
      )
    );
    const replacementReport = {
      ...buildSampleReport(),
      repo_metadata: {
        ...buildSampleReport().repo_metadata,
        clone_hash: "replacement-actions",
      },
    };
    const user = userEvent.setup();
    const { rerender } = render(<ReportTabs report={buildSampleReport()} />);

    await user.click(screen.getByRole("button", { name: "Share Candidate Brief" }));
    expect(await screen.findByRole("alert")).toBeInTheDocument();

    rerender(<ReportTabs report={replacementReport} />);

    await waitFor(() => expect(screen.queryByRole("alert")).toBeNull());
    expect(screen.getByRole("tab", { name: "Candidate Brief" })).toHaveAttribute(
      "aria-selected",
      "true"
    );
  });

  it("mounts the hidden report for export and clears the active export on replacement", async () => {
    const pendingSnapshot = deferred<HTMLCanvasElement>();
    html2canvas.mockReturnValueOnce(pendingSnapshot.promise);
    const replacementReport = {
      ...buildSampleReport(),
      repo_metadata: {
        ...buildSampleReport().repo_metadata,
        clone_hash: "replacement-export",
      },
    };
    const user = userEvent.setup();
    const { rerender } = render(<ReportTabs report={buildSampleReport()} />);

    await user.click(screen.getByRole("button", { name: "Export PDF" }));
    expect(
      await screen.findByRole("heading", { name: "Repo Analysis: repo-atlas" })
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Exporting PDF..." })).toBeDisabled();
    await waitFor(() => expect(html2canvas).toHaveBeenCalledOnce());

    rerender(<ReportTabs report={replacementReport} />);

    await waitFor(() =>
      expect(
        screen.queryByRole("heading", { name: "Repo Analysis: repo-atlas" })
      ).toBeNull()
    );
    expect(screen.getByRole("button", { name: "Export PDF" })).toBeEnabled();
    await act(async () => {
      pendingSnapshot.reject(new Error("Snapshot rendering failed."));
      await Promise.resolve();
    });
    expect(screen.queryByRole("alert")).toBeNull();
  });
});

describe("ReportTabs architecture integration", () => {
  it("keeps the graph engine lazy until the Architecture Map tab opens", async () => {
    const user = userEvent.setup();
    render(<ReportTabs report={buildSampleReport()} />);

    expect(layoutGraph).not.toHaveBeenCalled();
    await user.click(screen.getByRole("tab", { name: "Architecture Map" }));

    expect(await screen.findByRole("button", { name: "Zoom in" })).toBeEnabled();
    expect(layoutGraph).toHaveBeenCalledTimes(1);
    expect(screen.getByText("InputForm")).toBeInTheDocument();
  });

  it("keeps empty architecture guidance available after keyboard navigation", async () => {
    const report = {
      ...buildSampleReport(),
      architecture: { nodes: [], edges: [] },
      semantic_graph: undefined,
    };
    const user = userEvent.setup();
    render(<ReportTabs report={report} />);

    const architectureTab = screen.getByRole("tab", { name: "Architecture Map" });
    await user.click(architectureTab);

    expect(screen.getByText("No dependency map was produced.")).toBeInTheDocument();
    expect(layoutGraph).not.toHaveBeenCalled();

    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("tab", { name: "Start Here" })).toHaveAttribute(
      "aria-selected",
      "true"
    );
    expect(screen.getByRole("tabpanel")).toHaveTextContent("Start Here content");

    await user.keyboard("{ArrowLeft}");
    expect(architectureTab).toHaveAttribute("aria-selected", "true");
    expect(architectureTab).toHaveFocus();
    expect(screen.getByRole("tabpanel")).toHaveTextContent(
      "Check Candidate Brief confidence notes for analysis limits."
    );
  });
});

describe("ReportTabs panel coordination", () => {
  it("keeps exactly one linked panel active across all eight report sections", async () => {
    const user = userEvent.setup();
    render(<ReportTabs report={buildSampleReport()} />);

    for (const [tab, key] of [
      ["Candidate Brief", "candidate-brief"],
      ["Overview", "overview"],
      ["Folder Map", "folder-map"],
      ["Architecture Map", "architecture-map"],
      ["Start Here", "start-here"],
      ["Danger Zones", "danger-zones"],
      ["Run & Contribute", "run-contribute"],
      ["Export", "export"],
    ] as const) {
      await user.click(screen.getByRole("tab", { name: tab }));
      const activeTab = screen.getByRole("tab", { name: tab });
      const panel = screen.getByRole("tabpanel");

      expect(activeTab).toHaveAttribute("aria-selected", "true");
      expect(panel.id).toContain(`panel-${key}`);
      expect(panel).toHaveAttribute("aria-labelledby", activeTab.id);
    }
  });

  it("exposes and updates demo mode only in development", async () => {
    vi.stubEnv("NODE_ENV", "development");
    const user = userEvent.setup();

    render(<ReportTabs report={buildSampleReport()} initialDemoMode />);

    const demoMode = screen.getByRole("checkbox", { name: "Screenshot / demo mode" });
    expect(demoMode).toBeChecked();
    await user.click(demoMode);
    expect(demoMode).not.toBeChecked();
  });
});

describe("ReportTabs inline-share recovery", () => {
  it.each([
    "Private links are not supported in this browser. Export PDF to share this brief.",
    "This brief is too large for a private link. Export PDF to share it instead.",
  ])(
    "shows a PDF recovery without counting a failed share: %s",
    async (message) => {
      createPortableShareLink.mockRejectedValueOnce(new Error(message));
      const user = userEvent.setup();

      render(<ReportTabs report={buildSampleReport()} />);
      await user.click(screen.getByRole("button", { name: "Share Candidate Brief" }));

      expect(await screen.findByRole("alert")).toHaveTextContent(message);
      expect(screen.getByRole("button", { name: "Export PDF instead" })).toBeEnabled();
      expect(
        screen.queryByText(/Shared successfully|Private link copied/i)
      ).not.toBeInTheDocument();
      expect(captureReportShared).not.toHaveBeenCalled();
    },
    15_000
  );
});
