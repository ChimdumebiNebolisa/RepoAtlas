import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ComparisonEntrance } from "@/components/ComparisonEntrance";
import type { HomepageSamplePreview } from "@/lib/homepageSamplePreview";

const sample: HomepageSamplePreview = {
  repositoryName: "repo-ts",
  confidence: "high",
  summary: "A file-backed repository sample.",
  walkthrough: "Start at the health route and follow its supported evidence.",
  readingStep: {
    path: "src/app/api/health/route.ts",
    why: "Next.js route handler; detected entrypoint",
    evidence: {
      id: "start-1",
      kind: "start_here",
      label: "Health route",
      path: "src/app/api/health/route.ts",
    },
  },
  architecture: {
    explanation: "The route connects to supported repository files.",
    evidence: null,
  },
  interviewerQuestion: {
    question: "Where would you start?",
    rationale: "Explain the file-backed reading route.",
    evidence: null,
  },
};

afterEach(cleanup);

describe("ComparisonEntrance", () => {
  it("renders the structured-preparation action and complete file-backed proof", () => {
    render(<ComparisonEntrance sample={sample} variant="structured-preparation" />);

    expect(screen.getByRole("complementary")).toHaveAccessibleName(
      "Start an evidence-linked Candidate Brief",
    );
    expect(screen.getByRole("link", { name: "Try the sample interview route" })).toHaveAttribute(
      "href",
      "/?source=comparison_structured_preparation&sample=1#analyze",
    );
    expect(screen.getByTestId("comparison-sample-proof")).toHaveTextContent(
      "Evidence start-1 in src/app/api/health/route.ts",
    );
  });

  it("renders the AI-summary action and proof without an optional evidence path", () => {
    render(
      <ComparisonEntrance
        sample={{
          ...sample,
          readingStep: {
            ...sample.readingStep,
            evidence: {
              ...sample.readingStep.evidence!,
              path: undefined,
            },
          },
        }}
        variant="ai-summary"
      />,
    );

    expect(screen.getByRole("link", { name: "Try the evidence-linked sample" })).toHaveAttribute(
      "href",
      "/?source=comparison_ai_summary&sample=1#analyze",
    );
    expect(screen.getByTestId("comparison-sample-proof")).toHaveTextContent("Evidence start-1");
    expect(screen.getByTestId("comparison-sample-proof")).not.toHaveTextContent(
      "Evidence start-1 in",
    );
  });

  it("keeps the file-backed preview readable when its evidence record is unavailable", () => {
    render(
      <ComparisonEntrance
        sample={{
          ...sample,
          readingStep: {
            ...sample.readingStep,
            evidence: null,
          },
        }}
        variant="structured-preparation"
      />,
    );

    expect(screen.getByTestId("comparison-sample-proof")).toHaveTextContent(
      "src/app/api/health/route.ts",
    );
    expect(screen.getByTestId("comparison-sample-proof")).not.toHaveTextContent("Evidence start-1");
  });

  it("keeps both bounded start paths when preview evidence is unavailable", () => {
    render(<ComparisonEntrance sample={null} variant="structured-preparation" />);

    expect(
      screen.getByText("Open the bundled brief to inspect its available repository evidence."),
    ).toBeInTheDocument();
    expect(screen.queryByTestId("comparison-sample-proof")).not.toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /Use a public GitHub repository/i }),
    ).toHaveAttribute("href", "/?source=comparison_structured_preparation#analyze");
  });
});
