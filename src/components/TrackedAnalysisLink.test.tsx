import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const captureProductEvent = vi.hoisted(() => vi.fn());
const useSearchParams = vi.hoisted(() => vi.fn(() => new URLSearchParams()));

vi.mock("@/lib/productAnalytics", () => ({ captureProductEvent }));
vi.mock("next/navigation", () => ({ useSearchParams }));

import { TrackedAnalysisLink } from "./TrackedAnalysisLink";

describe("TrackedAnalysisLink", () => {
  afterEach(() => {
    cleanup();
    captureProductEvent.mockClear();
    useSearchParams.mockReturnValue(new URLSearchParams());
  });

  it("keeps the default interview-preparation attribution", () => {
    render(<TrackedAnalysisLink>Prepare</TrackedAnalysisLink>);

    expect(screen.getByRole("link", { name: /prepare/i })).toHaveAttribute(
      "href",
      "/?source=interview_preparation#analyze"
    );
  });

  it("carries an accepted opaque Cycle 3 source to the analysis form", () => {
    useSearchParams.mockReturnValue(new URLSearchParams("source=c3p1"));
    render(<TrackedAnalysisLink>Prepare</TrackedAnalysisLink>);

    expect(screen.getByRole("link", { name: /prepare/i })).toHaveAttribute(
      "href",
      "/?source=c3p1#analyze"
    );
  });
});
