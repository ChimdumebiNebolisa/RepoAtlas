import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ComparisonEntrance } from "@/components/ComparisonEntrance";
import type { HomepageSamplePreview } from "@/lib/homepageSamplePreview";

const sample: HomepageSamplePreview = {
  repositoryName: "repo-ts",
  confidence: "high",
  purpose: "repo-ts appears to be a Next.js application",
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
  comparisonProof: {
    readingSequence: [
      "src/app/api/health/route.ts",
      "src/app/page.tsx",
      "src/app/layout.tsx",
    ],
    dangerZone: {
      path: "src/bootstrap.ts",
      score: 79,
      complexity: 9,
      fanOut: 2,
    },
  },
  architecture: {
    connection: "Health route connects to supported repository files.",
    explanation: "The route connects to supported repository files.",
    evidence: null,
  },
  interviewerQuestion: {
    question: "Where would you start?",
    rationale: "Explain the file-backed reading route.",
    evidence: null,
  },
};

const evidenceBackedBriefPromise =
  "Prepare to explain a repository with the ranked reading path, architecture context, source-backed commands, test inventory, and structural risk signals shown in the public FastAPI example. The example contains 12 starting files, 35 architecture nodes, 8 commands, 23 test files, and 127 risk signals. Its risk signals guide inspection; they do not prove runtime behavior, bugs, or vulnerabilities.";

afterEach(cleanup);

describe("ComparisonEntrance", () => {
  it("renders the structured-preparation action and complete file-backed proof", () => {
    render(<ComparisonEntrance sample={sample} variant="structured-preparation" />);

    expect(screen.getByRole("complementary")).toHaveAccessibleName(
      "Start an evidence-linked Candidate Brief",
    );
    expect(screen.getByRole("link", { name: "Open the sample Candidate Brief" })).toHaveAttribute(
      "href",
      "/?source=comparison_structured_preparation&sample=1#analyze",
    );
    expect(screen.getByTestId("comparison-sample-proof")).toHaveTextContent(
      "src/app/api/health/route.tssrc/app/page.tsxsrc/app/layout.tsx",
    );
    expect(screen.getByTestId("comparison-sample-proof")).toHaveTextContent(
      "src/bootstrap.tsRisk 79 out of 100, with complexity 9 and 2 outgoing file links.",
    );
    expect(screen.getByTestId("comparison-sample-proof")).not.toHaveTextContent("start-1");
    expect(screen.getByText(evidenceBackedBriefPromise)).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /Inspect the public FastAPI repository example/i }),
    ).toHaveAttribute("href", "/examples/fastapi-candidate-brief");
  });

  it("renders the AI-summary action with the same exact bundled proof", () => {
    render(
      <ComparisonEntrance sample={sample} variant="ai-summary" />,
    );

    expect(screen.getByRole("link", { name: "Open the sample Candidate Brief" })).toHaveAttribute(
      "href",
      "/?source=comparison_ai_summary&sample=1#analyze",
    );
    expect(screen.getByTestId("comparison-sample-proof")).toHaveTextContent(
      "src/bootstrap.tsRisk 79 out of 100",
    );
    expect(screen.getByText(evidenceBackedBriefPromise)).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /Inspect the public FastAPI repository example/i }),
    ).toHaveAttribute("href", "/examples/fastapi-candidate-brief");
  });

  it("keeps the first file-backed reading item when the comparison proof is unavailable", () => {
    render(
      <ComparisonEntrance
        sample={{
          ...sample,
          comparisonProof: null,
        }}
        variant="structured-preparation"
      />,
    );

    expect(screen.getByTestId("comparison-sample-proof")).toHaveTextContent(
      "src/app/api/health/route.ts",
    );
    expect(screen.getByTestId("comparison-sample-proof")).not.toHaveTextContent("Danger Zone");
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
