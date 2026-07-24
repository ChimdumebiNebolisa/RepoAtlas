import React from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildSampleReport } from "@/lib/buildSampleReport";
import type { Report } from "@/types/report";

const generateSample = vi.hoisted(() => vi.fn());

vi.mock("@/components/HomepageProofSections", () => ({
  HomepageHero: ({
    onGenerateSample,
  }: {
    onGenerateSample: () => void;
  }) => <button onClick={onGenerateSample}>Generate from hero</button>,
  HomepageWalkthroughOutcomes: () => <div>Walkthrough outcomes</div>,
  HomepageSampleProof: ({
    showSampleReport,
    onOpenSample,
    sectionRef,
  }: {
    showSampleReport: boolean;
    onOpenSample: () => void;
    sectionRef: React.RefObject<HTMLElement | null>;
  }) => (
    <section ref={sectionRef} data-testid="sample-proof">
      <button onClick={onOpenSample}>Open sample proof</button>
      {showSampleReport ? <div>Complete sample report</div> : null}
    </section>
  ),
  HomepageTrustAndFaq: () => <div>Trust and FAQ</div>,
}));

vi.mock("@/components/InputForm", async () => {
  const ReactModule = await import("react");
  return {
    InputForm: ReactModule.forwardRef(function MockInputForm(
      {
        onAnalyzeStart,
        onAnalyzeComplete,
        onAnalyzeError,
        loading,
        sampleButtonRef,
      }: {
        onAnalyzeStart: () => void;
        onAnalyzeComplete: (report: Report, reportId: string | null) => void;
        onAnalyzeError: (message: string) => void;
        loading: boolean;
        sampleButtonRef?: React.RefObject<HTMLButtonElement | null>;
      },
      forwardedRef: React.ForwardedRef<{ generateSample: () => void }>
    ) {
      const inlineReport = buildSampleReport();
      const focusedReport = structuredClone(inlineReport);
      if (focusedReport.candidate_brief) {
        focusedReport.candidate_brief.analysis_focus = {
          intent: "bug",
          label: "Bug investigation",
          summary: "Review the suspected failure without asserting a defect.",
          review_steps: [],
          discussion_questions: [],
        };
      }

      ReactModule.useImperativeHandle(forwardedRef, () => ({ generateSample }));

      return (
        <div>
          <span>{loading ? "Loading analysis" : "Analysis idle"}</span>
          <button ref={sampleButtonRef} type="button">Sample action</button>
          <button type="button" onClick={onAnalyzeStart}>Start analysis</button>
          <button
            type="button"
            onClick={() => onAnalyzeComplete(inlineReport, null)}
          >
            Complete inline
          </button>
          <button
            type="button"
            onClick={() => onAnalyzeComplete(inlineReport, "saved-report-id")}
          >
            Complete saved
          </button>
          <button
            type="button"
            onClick={() => onAnalyzeComplete(focusedReport, null)}
          >
            Complete focused
          </button>
          <button
            type="button"
            onClick={() => onAnalyzeError("Analysis could not be completed.")}
          >
            Fail analysis
          </button>
        </div>
      );
    }),
  };
});

vi.mock("@/components/ReportTabs", () => ({
  ReportTabs: ({
    report,
    reportId,
  }: {
    report: Report;
    reportId?: string | null;
  }) => (
    <div>
      Report workspace for {report.repo_metadata.name}
      <span>{reportId ? `Saved as ${reportId}` : "Inline report"}</span>
    </div>
  ),
}));

import { HomePage } from "./HomePage";

describe("HomePage completion coordination", () => {
  let animationFrames: Map<number, FrameRequestCallback>;
  let nextFrameId: number;
  let cancelAnimationFrame: ReturnType<typeof vi.fn>;
  let scrollIntoView: ReturnType<typeof vi.fn>;

  function runNextFrame() {
    const first = animationFrames.entries().next().value as
      | [number, FrameRequestCallback]
      | undefined;
    if (!first) throw new Error("Expected a pending animation frame.");
    animationFrames.delete(first[0]);
    act(() => first[1](0));
  }

  beforeEach(() => {
    animationFrames = new Map();
    nextFrameId = 1;
    generateSample.mockReset();
    scrollIntoView = vi.fn();
    cancelAnimationFrame = vi.fn((id: number) => {
      animationFrames.delete(id);
    });
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      const id = nextFrameId++;
      animationFrames.set(id, callback);
      return id;
    });
    vi.stubGlobal("cancelAnimationFrame", cancelAnimationFrame);
    Element.prototype.scrollIntoView = scrollIntoView;
  });

  afterEach(() => {
    document.documentElement.style.scrollBehavior = "";
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    cleanup();
  });

  it("starts the bundled sample from the hero and schedules the sample control into view", async () => {
    const user = userEvent.setup();
    render(<HomePage sampleReport={buildSampleReport()} />);

    await user.click(screen.getByRole("button", { name: "Generate from hero" }));

    expect(generateSample).toHaveBeenCalledTimes(1);
    expect(animationFrames).toHaveLength(1);
    runNextFrame();
    expect(scrollIntoView).toHaveBeenCalledWith({
      behavior: "smooth",
      block: "center",
    });
  });

  it("opens the complete sample proof and schedules it into view", async () => {
    const user = userEvent.setup();
    render(<HomePage sampleReport={buildSampleReport()} />);

    await user.click(screen.getByRole("button", { name: "Open sample proof" }));

    expect(screen.getByText("Complete sample report")).toBeInTheDocument();
    runNextFrame();
    expect(scrollIntoView).toHaveBeenCalledWith({
      behavior: "smooth",
      block: "start",
    });
  });

  it("removes an earlier brief when a new analysis starts and keeps it removed on failure", () => {
    render(<HomePage sampleReport={buildSampleReport()} />);

    fireEvent.click(screen.getByRole("button", { name: "Complete saved" }));
    expect(screen.getByTestId("generated-report")).toBeInTheDocument();
    expect(screen.getByText("Saved as saved-report-id")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Start analysis" }));
    expect(screen.getByText("Loading analysis")).toBeInTheDocument();
    expect(screen.queryByTestId("generated-report")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Fail analysis" }));
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Analysis could not be completed."
    );
    expect(screen.getByText("Analysis idle")).toBeInTheDocument();
    expect(screen.queryByTestId("generated-report")).not.toBeInTheDocument();
  });

  it("renders truthful inline, saved, and focused completion guidance", () => {
    render(<HomePage sampleReport={buildSampleReport()} />);

    fireEvent.click(screen.getByRole("button", { name: "Complete inline" }));
    expect(
      screen.getByText(/inspect or export the evidence-linked report as PDF or PNG/)
    ).toBeInTheDocument();
    expect(screen.getByText("Inline report")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Complete saved" }));
    expect(
      screen.getByText(/inspect, export, or share the evidence-linked report/)
    ).toBeInTheDocument();
    expect(screen.getByText("Saved as saved-report-id")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Complete focused" }));
    expect(
      screen.getByText(
        "Your bug investigation brief is complete and tied to repository evidence."
      )
    ).toBeInTheDocument();
  });

  it("focuses a completed brief without smooth scrolling and restores the page setting", () => {
    document.documentElement.style.scrollBehavior = "smooth";
    render(<HomePage sampleReport={buildSampleReport()} />);

    fireEvent.click(screen.getByRole("button", { name: "Complete inline" }));
    const heading = screen.getByTestId("completed-report-heading");
    runNextFrame();

    expect(scrollIntoView).toHaveBeenCalledWith({ block: "start" });
    expect(heading).toHaveFocus();
    expect(document.documentElement.style.scrollBehavior).toBe("smooth");
  });

  it("cancels a pending completion focus when the report is cleared or the page unmounts", () => {
    const { unmount } = render(<HomePage sampleReport={buildSampleReport()} />);

    fireEvent.click(screen.getByRole("button", { name: "Complete inline" }));
    expect(animationFrames).toHaveLength(1);

    fireEvent.click(screen.getByRole("button", { name: "Start analysis" }));
    expect(cancelAnimationFrame).toHaveBeenCalledWith(1);
    expect(animationFrames).toHaveLength(0);

    fireEvent.click(screen.getByRole("button", { name: "Complete inline" }));
    expect(animationFrames).toHaveLength(1);
    unmount();
    expect(cancelAnimationFrame).toHaveBeenCalledWith(2);
    expect(animationFrames).toHaveLength(0);
  });
});
