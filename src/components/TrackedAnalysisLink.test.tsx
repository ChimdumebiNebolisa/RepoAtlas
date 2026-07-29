import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const captureProductEvent = vi.hoisted(() => vi.fn());
const useSearchParams = vi.hoisted(() => vi.fn(() => new URLSearchParams()));

vi.mock("@/lib/productAnalytics", () => ({ captureProductEvent }));
vi.mock("next/navigation", () => ({ useSearchParams }));

import { TrackedAnalysisLink } from "./TrackedAnalysisLink";

function clickWithoutNavigation(link: HTMLElement) {
  link.addEventListener("click", (event) => event.preventDefault(), {
    once: true,
  });
  fireEvent.click(link);
}

describe("TrackedAnalysisLink", () => {
  afterEach(() => {
    cleanup();
    captureProductEvent.mockClear();
    useSearchParams.mockReturnValue(new URLSearchParams());
  });

  it("keeps the default interview-preparation destination and bounded click event", () => {
    render(<TrackedAnalysisLink>Prepare</TrackedAnalysisLink>);

    const link = screen.getByRole("link", { name: /prepare/i });
    expect(link).toHaveAttribute(
      "href",
      "/?source=interview_preparation#analyze"
    );
    clickWithoutNavigation(link);

    expect(captureProductEvent).toHaveBeenCalledOnce();
    expect(captureProductEvent).toHaveBeenCalledWith("analysis_cta_clicked", {
      source: "interview_preparation",
      destination: "analysis_start",
    });
  });

  it.each(["c3p1", "c3p2"] as const)(
    "carries accepted opaque source %s through the destination and click event",
    (entrySource) => {
      useSearchParams.mockReturnValue(
        new URLSearchParams(`source=${entrySource}`)
      );
      render(<TrackedAnalysisLink>Prepare</TrackedAnalysisLink>);

      const link = screen.getByRole("link", { name: /prepare/i });
      expect(link).toHaveAttribute(
        "href",
        `/?source=${entrySource}#analyze`
      );
      clickWithoutNavigation(link);

      expect(captureProductEvent).toHaveBeenCalledOnce();
      expect(captureProductEvent).toHaveBeenCalledWith("analysis_cta_clicked", {
        source: "interview_preparation",
        destination: "analysis_start",
        entry_source: entrySource,
      });
    }
  );

  it.each([
    "comparison_structured_preparation",
    "comparison_ai_summary",
  ] as const)(
    "uses fixed bounded comparison source %s instead of an incoming source",
    (entrySource) => {
      useSearchParams.mockReturnValue(new URLSearchParams("source=c3p1"));
      render(
        <TrackedAnalysisLink
          className="comparison-primary-action"
          entrySource={entrySource}
        >
          Prepare
        </TrackedAnalysisLink>
      );

      const link = screen.getByRole("link", { name: /prepare/i });
      expect(link).toHaveClass("comparison-primary-action");
      expect(link).toHaveAttribute(
        "href",
        `/?source=${entrySource}#analyze`
      );
      clickWithoutNavigation(link);

      expect(captureProductEvent).toHaveBeenCalledOnce();
      expect(captureProductEvent).toHaveBeenCalledWith("analysis_cta_clicked", {
        source: "interview_preparation",
        destination: "analysis_start",
        entry_source: entrySource,
      });
    }
  );

  it("adds the bounded direct-sample flag without changing attribution", () => {
    render(
      <TrackedAnalysisLink
        entrySource="comparison_structured_preparation"
        startSample
      >
        Run sample
      </TrackedAnalysisLink>,
    );

    const link = screen.getByRole("link", { name: /run sample/i });
    expect(link).toHaveAttribute(
      "href",
      "/?source=comparison_structured_preparation&sample=1#analyze",
    );
    clickWithoutNavigation(link);

    expect(captureProductEvent).toHaveBeenCalledWith("analysis_cta_clicked", {
      source: "interview_preparation",
      destination: "analysis_start",
      entry_source: "comparison_structured_preparation",
    });
  });

  it("drops an invalid fixed source without blocking the interview destination", () => {
    render(
      <TrackedAnalysisLink entrySource={"private-repository-name" as never}>
        Prepare
      </TrackedAnalysisLink>
    );

    const link = screen.getByRole("link", { name: /prepare/i });
    expect(link).toHaveAttribute(
      "href",
      "/?source=interview_preparation#analyze"
    );
    clickWithoutNavigation(link);

    expect(captureProductEvent).toHaveBeenCalledOnce();
    expect(captureProductEvent).toHaveBeenCalledWith("analysis_cta_clicked", {
      source: "interview_preparation",
      destination: "analysis_start",
    });
  });

  it.each([
    "private-repository-name",
    "c3p3",
    "C3P1",
    " c3p1 ",
  ])("drops rejected source %s from the destination and click event", (source) => {
    useSearchParams.mockReturnValue(
      new URLSearchParams({ source })
    );
    render(<TrackedAnalysisLink>Prepare</TrackedAnalysisLink>);

    const link = screen.getByRole("link", { name: /prepare/i });
    expect(link).toHaveAttribute(
      "href",
      "/?source=interview_preparation#analyze"
    );
    clickWithoutNavigation(link);

    expect(captureProductEvent).toHaveBeenCalledOnce();
    expect(captureProductEvent).toHaveBeenCalledWith("analysis_cta_clicked", {
      source: "interview_preparation",
      destination: "analysis_start",
    });
  });
});
