import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { buildSampleReport } from "@/lib/buildSampleReport";
import type { CandidateBrief } from "@/types/report";
import { CandidateBriefPanel } from "./CandidateBriefPanel";

const captureWalkthroughCopied = vi.hoisted(() => vi.fn());
const sampleBrief = buildSampleReport().candidate_brief;

vi.mock("@/lib/productAnalytics", () => ({ captureWalkthroughCopied }));
vi.mock("@/components/CopyButton", async () => {
  const { createElement } = await import("react");
  return {
    CopyButton: ({
      text,
      label = "Copy",
      onCopySuccess,
    }: {
      text: string;
      label?: string;
      onCopySuccess?: () => void;
    }) =>
      createElement(
        "button",
        {
          type: "button",
          onClick: async () => {
            await navigator.clipboard.writeText(text);
            onCopySuccess?.();
          },
        },
        label
      ),
  };
});
vi.mock("@/components/CandidateBriefEvidence", async () => {
  const { createElement } = await import("react");
  return {
    CandidateBriefEvidence: () =>
      createElement("section", null, createElement("h3", null, "Evidence")),
  };
});
vi.mock("@/components/EvidenceLinks", async () => {
  const { createElement } = await import("react");
  return {
    EvidenceList: ({
      ids,
      evidenceById,
      onNavigate,
    }: {
      ids: string[];
      evidenceById: Map<string, unknown>;
      onNavigate?: (id: string) => void;
    }) =>
      createElement(
        "div",
        null,
        ...Array.from(new Set(ids))
          .filter((id) => evidenceById.has(id))
          .map((id) =>
            createElement(
              "button",
              { key: id, type: "button", onClick: () => onNavigate?.(id) },
              id
            )
          )
      ),
  };
});

afterEach(() => {
  captureWalkthroughCopied.mockReset();
  vi.unstubAllGlobals();
  cleanup();
});

function buildSampleBrief(): CandidateBrief {
  if (!sampleBrief) throw new Error("Expected the bundled sample to include a Candidate Brief.");
  return sampleBrief;
}

describe("CandidateBriefPanel tradeoff answer", () => {
  it("shows an evidence-linked tradeoff answer in the four primary questions", () => {
    const brief = buildSampleBrief();

    render(
      <CandidateBriefPanel
        candidateBrief={{
          ...brief,
          reading_path: [],
          first_pr_plan: [],
          resume_bullets: [],
          warnings: [],
          confidence_assessment: undefined,
          walkthrough_script: undefined,
          behavioral_hooks: [],
          interview_questions: [],
          evidence_refs: brief.evidence_refs.filter(
            (ref) => ref.id === "sample-decision-package"
          ),
        }}
      />
    );

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
    const brief = buildSampleBrief();

    render(
      <CandidateBriefPanel
        demoMode
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
    const brief = buildSampleBrief();

    render(<CandidateBriefPanel candidateBrief={brief} demoMode />);

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

  it("records only confirmed 30-second and 2-minute copies with the report variant", async () => {
    const user = userEvent.setup();
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { clipboard: { writeText } });
    const brief = buildSampleBrief();

    render(<CandidateBriefPanel candidateBrief={brief} demoMode reportVariant="preview" />);
    await user.click(screen.getByRole("button", { name: "Copy 30s" }));
    await user.click(screen.getByRole("button", { name: "Copy 2min" }));

    await waitFor(() => expect(captureWalkthroughCopied).toHaveBeenCalledTimes(2));
    expect(writeText).toHaveBeenNthCalledWith(1, brief.walkthrough_script?.thirty_second);
    expect(writeText).toHaveBeenNthCalledWith(2, brief.walkthrough_script?.two_minute);
    expect(captureWalkthroughCopied).toHaveBeenNthCalledWith(1, "preview", "30_second");
    expect(captureWalkthroughCopied).toHaveBeenNthCalledWith(2, "preview", "2_minute");
  });

  it("states when the repository cannot support a system-flow claim", () => {
    const brief = buildSampleBrief();

    render(
      <CandidateBriefPanel
        demoMode
        candidateBrief={{
          ...brief,
          walkthrough_script: brief.walkthrough_script
            ? {
                ...brief.walkthrough_script,
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

describe("CandidateBriefPanel report states", () => {
  it("renders a bounded unavailable state when a report has no Candidate Brief", () => {
    render(<CandidateBriefPanel />);

    expect(screen.getByText(/Candidate Brief is not available for this report/i)).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Repo Summary" })).not.toBeInTheDocument();
  });

  it("renders a partial brief without inventing optional evidence", () => {
    const brief = buildSampleBrief();
    const legacyTalkingPoints = {
      ...brief.interview_talking_points,
      tradeoffs: undefined,
    } as unknown as CandidateBrief["interview_talking_points"];

    render(
      <CandidateBriefPanel
        demoMode
        candidateBrief={{
          ...brief,
          reading_path: [],
          interview_talking_points: legacyTalkingPoints,
          evidence_refs: [],
          warnings: [],
          confidence_assessment: {
            level: "low",
            reasons: ["Analysis stopped after repository indexing."],
            gaps: [],
          },
          walkthrough_script: undefined,
          behavioral_hooks: [],
          interview_questions: [],
        }}
      />
    );

    expect(screen.getByText("No ranked reading path was generated.")).toBeInTheDocument();
    expect(screen.getByText(/does not provide enough evidence for a system flow/i)).toBeInTheDocument();
    expect(screen.getByText(/saved report predates direct tradeoff evidence/i)).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Walkthrough Script" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Behavioral Hooks" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Interview Questions" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Confidence Notes" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Evidence" })).not.toBeInTheDocument();
  });

  it("renders an issue-focused review path with its direct evidence", () => {
    const brief = buildSampleBrief();

    render(
      <CandidateBriefPanel
        candidateBrief={{
          ...brief,
          evidence_refs: brief.evidence_refs.filter(
            (ref) => ref.id === "sample-decision-package"
          ),
          analysis_focus: {
            intent: "bug",
            label: "Bug investigation",
            summary: "Trace the reported failure from the request boundary to analysis.",
            review_steps: [
              {
                title: "Start at the request boundary",
                detail: "Confirm how the request enters the analysis pipeline.",
                evidence_refs: ["sample-decision-package"],
              },
            ],
            discussion_questions: ["Which failure should be reproduced first?"],
          },
        }}
      />
    );

    expect(screen.getByText("Issue-focused Candidate Brief")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Bug investigation" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Start at the request boundary" })).toBeInTheDocument();
    expect(screen.getByText("Which failure should be reproduced first?")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "sample-decision-package" }).length).toBeGreaterThan(0);
  });

  it("renders warning notes with and without evidence references", () => {
    const brief = buildSampleBrief();

    render(
      <CandidateBriefPanel
        candidateBrief={{
          ...brief,
          evidence_refs: brief.evidence_refs.filter(
            (ref) => ref.id === "sample-decision-package"
          ),
          warnings: [
            {
              message: "A generated entry point needs manual confirmation.",
              evidence_refs: ["sample-decision-package"],
            },
            { message: "Runtime behavior was not executed." },
          ],
        }}
      />
    );

    const notes = screen.getByRole("heading", { name: "Confidence Notes" }).closest("section");
    expect(notes).not.toBeNull();
    expect(within(notes!).getByText("A generated entry point needs manual confirmation.")).toBeInTheDocument();
    expect(within(notes!).getByText("Runtime behavior was not executed.")).toBeInTheDocument();
    expect(within(notes!).getByRole("button", { name: "sample-decision-package" })).toBeInTheDocument();
  });
});
