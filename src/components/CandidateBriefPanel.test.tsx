import React from "react";
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import { buildSampleReport } from "@/lib/buildSampleReport";
import { CandidateBriefPanel } from "./CandidateBriefPanel";

afterEach(cleanup);

describe("CandidateBriefPanel tradeoff answer", () => {
  it("shows an evidence-linked tradeoff answer in the four primary questions", () => {
    const brief = buildSampleReport().candidate_brief;
    expect(brief).toBeDefined();

    render(<CandidateBriefPanel candidateBrief={brief} />);

    const section = screen
      .getByRole("heading", { name: "Interview Talking Points" })
      .closest("section");
    expect(section).not.toBeNull();
    const primaryQuestions = within(section!).getAllByRole("heading", { level: 4 }).slice(0, 4);

    expect(primaryQuestions.map((heading) => heading.textContent)).toEqual([
      "Walk me through this codebase",
      "What are the riskiest areas?",
      "What tradeoffs does this repository contain?",
      "What would you improve first?",
    ]);
    expect(
      within(section!).getByText(/repository directly shows Next\.js, Tailwind CSS, Vitest/i)
    ).toBeInTheDocument();
    expect(within(section!).getByRole("button", { name: "sample-decision-package" })).toBeInTheDocument();
    expect(within(section!).getByText("Extra preparation")).toBeInTheDocument();
    expect(
      within(section!).getByRole("heading", { name: "How would you contribute in your first week?" })
    ).toBeInTheDocument();
  });

  it("states when direct repository evidence cannot support a tradeoff answer", () => {
    const brief = buildSampleReport().candidate_brief;
    expect(brief).toBeDefined();
    if (!brief) return;

    render(
      <CandidateBriefPanel
        candidateBrief={{
          ...brief,
          interview_talking_points: {
            ...brief.interview_talking_points,
            tradeoffs: {
              answer:
                "This repository does not provide enough direct evidence for a defensible tradeoff answer.",
              bullets: [
                "The brief does not infer maintainer intent, rejected alternatives, or production behavior.",
              ],
              evidence_refs: [],
              confidence: "low",
            },
          },
        }}
      />
    );

    expect(
      screen.getByText(
        "This repository does not provide enough direct evidence for a defensible tradeoff answer."
      )
    ).toBeInTheDocument();
    expect(screen.getByText(/does not infer maintainer intent/i)).toBeInTheDocument();
  });
});
