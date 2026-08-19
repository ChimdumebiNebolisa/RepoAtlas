import { cleanup, render, screen } from "@testing-library/react";
import type { ReactElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import AiCodebaseSummaryPage from "./ai-codebase-summary/page";
import CodebaseInterviewPreparationPage from "./codebase-interview-preparation/page";
import CodeReviewInterviewPage from "./code-review-interview/page";
import FastApiCandidateBriefExamplePage from "./examples/fastapi-candidate-brief/page";
import AuthoredProjectWalkthroughPage from "./how-to-walk-through-a-project-in-an-interview/page";
import InterviewPreparationPage from "./interview-preparation/page";
import RepositoryWalkthroughInterviewPage from "./repository-walkthrough-interview/page";
import TakeHomeCodingInterviewPage from "./take-home-coding-interview/page";

type ClusterPage = {
  name: string;
  renderPage: () => ReactElement | Promise<ReactElement>;
  requiredDestinations: string[];
  primaryActionHref: string | null;
};

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(),
}));

const clusterPages: ClusterPage[] = [
  {
    name: "interview preparation guide",
    renderPage: InterviewPreparationPage,
    requiredDestinations: [
      "/examples/fastapi-candidate-brief",
      "/code-review-interview",
    ],
    primaryActionHref: "/?source=interview_preparation&sample=1#analyze",
  },
  {
    name: "repository walkthrough guide",
    renderPage: RepositoryWalkthroughInterviewPage,
    requiredDestinations: [
      "/examples/fastapi-candidate-brief",
      "/codebase-interview-preparation",
      "/ai-codebase-summary",
      "/take-home-coding-interview",
      "/code-review-interview",
    ],
    primaryActionHref: "/?source=interview_preparation&sample=1#analyze",
  },
  {
    name: "authored project guide",
    renderPage: AuthoredProjectWalkthroughPage,
    requiredDestinations: [
      "/examples/fastapi-candidate-brief",
      "/codebase-interview-preparation",
      "/ai-codebase-summary",
      "/take-home-coding-interview",
      "/code-review-interview",
    ],
    primaryActionHref: "/?source=interview_preparation&sample=1#analyze",
  },
  {
    name: "take-home coding interview guide",
    renderPage: TakeHomeCodingInterviewPage,
    requiredDestinations: [
      "/examples/fastapi-candidate-brief",
      "/repository-walkthrough-interview",
      "/how-to-walk-through-a-project-in-an-interview",
    ],
    primaryActionHref: "/?source=interview_preparation&sample=1#analyze",
  },
  {
    name: "structured preparation comparison",
    renderPage: CodebaseInterviewPreparationPage,
    requiredDestinations: [
      "/repository-walkthrough-interview",
      "/how-to-walk-through-a-project-in-an-interview",
    ],
    primaryActionHref: "/?source=comparison_structured_preparation&sample=1#analyze",
  },
  {
    name: "AI summary comparison",
    renderPage: AiCodebaseSummaryPage,
    requiredDestinations: [
      "/repository-walkthrough-interview",
      "/how-to-walk-through-a-project-in-an-interview",
    ],
    primaryActionHref: "/?source=comparison_ai_summary&sample=1#analyze",
  },
  {
    name: "code review interview guide",
    renderPage: CodeReviewInterviewPage,
    requiredDestinations: [
      "/examples/fastapi-candidate-brief",
      "/repository-walkthrough-interview",
      "/codebase-interview-preparation",
    ],
    primaryActionHref: "/?source=interview_preparation&sample=1#analyze",
  },
  {
    name: "FastAPI Candidate Brief example",
    renderPage: FastApiCandidateBriefExamplePage,
    requiredDestinations: [
      "/repository-walkthrough-interview",
      "/?source=fastapi_example&sample=1#analyze",
    ],
    primaryActionHref: null,
  },
];

afterEach(cleanup);

describe.each(clusterPages)("$name", ({ renderPage, requiredDestinations, primaryActionHref }) => {
  it("keeps its cluster destinations and sample-first action hierarchy", async () => {
    render(await renderPage());

    const links = screen.getAllByRole("link");
    for (const destination of requiredDestinations) {
      expect(links.some((link) => link.getAttribute("href") === destination)).toBe(true);
    }

    const primaryActions = links.filter((link) => link.classList.contains("btn-primary"));
    if (primaryActionHref) {
      expect(primaryActions).toHaveLength(1);
      expect(primaryActions[0]).toHaveAttribute("href", primaryActionHref);
    } else {
      expect(primaryActions).toHaveLength(0);
    }
  });
});
