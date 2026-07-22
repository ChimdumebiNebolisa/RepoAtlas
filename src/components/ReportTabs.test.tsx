import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { buildSampleReport } from "@/lib/buildSampleReport";
import { ReportTabs } from "./ReportTabs";

const createPortableShareLink = vi.hoisted(() => vi.fn());
const captureReportShared = vi.hoisted(() => vi.fn());
const captureReportViewed = vi.hoisted(() => vi.fn());
const layoutGraph = vi.hoisted(() => vi.fn());

vi.mock("@/lib/portableSharing", () => ({ createPortableShareLink }));
vi.mock("@/lib/elkLayout", () => ({ layoutGraph }));
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

      rerender(<ReportTabs report={report} variant={variant} />);
      expect(captureReportViewed).toHaveBeenCalledTimes(1);
    }
  );
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
