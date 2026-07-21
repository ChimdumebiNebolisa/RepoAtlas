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

describe("CandidateBriefPanel walkthrough hierarchy", () => {
  it("opens with the required interview sequence", () => {
    const brief = buildSampleReport().candidate_brief;
    expect(brief).toBeDefined();

    render(<CandidateBriefPanel candidateBrief={brief} />);

    const walkthrough = screen.getByTestId("walkthrough-script");
    const requiredOrder = [
      "Repo Summary",
      "Walkthrough Script",
      "30-second",
      "2-minute",
      "Reading Path",
      "System Flow",
      "Interview Talking Points",
    ].map((name) => screen.getByRole("heading", { name }));

    for (let index = 1; index < requiredOrder.length; index += 1) {
      expect(requiredOrder[index - 1].compareDocumentPosition(requiredOrder[index])).toBe(
        Node.DOCUMENT_POSITION_FOLLOWING
      );
    }

    expect(within(walkthrough).getByText(/quick introduction/i)).toBeInTheDocument();
    expect(within(walkthrough).getByText(/explain the reading path/i)).toBeInTheDocument();
    expect(within(walkthrough).getByRole("button", { name: "Copy 30s" })).toBeInTheDocument();
    expect(within(walkthrough).getByRole("button", { name: "Copy 2min" })).toBeInTheDocument();
  });

  it("states when the repository cannot support a system-flow claim", () => {
    const brief = buildSampleReport().candidate_brief;
    expect(brief).toBeDefined();

    render(
      <CandidateBriefPanel
        candidateBrief={{
          ...brief!,
          walkthrough_script: brief!.walkthrough_script
            ? {
                ...brief!.walkthrough_script,
                deep_technical: "Not enough evidence to describe the system flow.",
                evidence_refs: [],
              }
            : undefined,
        }}
      />
    );

    expect(
      screen.getByText(/does not provide enough evidence for a system flow/i)
    ).toBeInTheDocument();
  });
});
