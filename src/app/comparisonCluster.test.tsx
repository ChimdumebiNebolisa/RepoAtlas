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
  path: string;
  renderPage: () => ReactElement | Promise<ReactElement>;
  requiredDestinations: string[];
  primaryActionHref: string | null;
  sampleActionHref: string;
  sampleGroupSelector: string;
};

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(),
}));

const clusterPages: ClusterPage[] = [
  {
    name: "interview preparation guide",
    path: "/interview-preparation",
    renderPage: InterviewPreparationPage,
    requiredDestinations: [
      "/examples/fastapi-candidate-brief",
      "/code-review-interview",
    ],
    primaryActionHref: "/?source=interview_preparation&sample=1#analyze",
    sampleActionHref: "/?source=interview_preparation&sample=1#analyze",
    sampleGroupSelector: ".interview-hero-copy",
  },
  {
    name: "repository walkthrough guide",
    path: "/repository-walkthrough-interview",
    renderPage: RepositoryWalkthroughInterviewPage,
    requiredDestinations: [
      "/examples/fastapi-candidate-brief",
      "/codebase-interview-preparation",
      "/ai-codebase-summary",
      "/take-home-coding-interview",
      "/code-review-interview",
    ],
    primaryActionHref: "/?source=interview_preparation&sample=1#analyze",
    sampleActionHref: "/?source=interview_preparation&sample=1#analyze",
    sampleGroupSelector: ".guide-start-actions",
  },
  {
    name: "authored project guide",
    path: "/how-to-walk-through-a-project-in-an-interview",
    renderPage: AuthoredProjectWalkthroughPage,
    requiredDestinations: [
      "/examples/fastapi-candidate-brief",
      "/codebase-interview-preparation",
      "/ai-codebase-summary",
      "/take-home-coding-interview",
      "/code-review-interview",
    ],
    primaryActionHref: "/?source=interview_preparation&sample=1#analyze",
    sampleActionHref: "/?source=interview_preparation&sample=1#analyze",
    sampleGroupSelector: ".guide-start-actions",
  },
  {
    name: "take-home coding interview guide",
    path: "/take-home-coding-interview",
    renderPage: TakeHomeCodingInterviewPage,
    requiredDestinations: [
      "/examples/fastapi-candidate-brief",
      "/repository-walkthrough-interview",
      "/how-to-walk-through-a-project-in-an-interview",
    ],
    primaryActionHref: "/?source=interview_preparation&sample=1#analyze",
    sampleActionHref: "/?source=interview_preparation&sample=1#analyze",
    sampleGroupSelector: ".guide-start-actions",
  },
  {
    name: "structured preparation comparison",
    path: "/codebase-interview-preparation",
    renderPage: CodebaseInterviewPreparationPage,
    requiredDestinations: [
      "/repository-walkthrough-interview",
      "/how-to-walk-through-a-project-in-an-interview",
    ],
    primaryActionHref: "/?source=comparison_structured_preparation&sample=1#analyze",
    sampleActionHref: "/?source=comparison_structured_preparation&sample=1#analyze",
    sampleGroupSelector: ".comparison-entrance-actions",
  },
  {
    name: "AI summary comparison",
    path: "/ai-codebase-summary",
    renderPage: AiCodebaseSummaryPage,
    requiredDestinations: [
      "/repository-walkthrough-interview",
      "/how-to-walk-through-a-project-in-an-interview",
    ],
    primaryActionHref: "/?source=comparison_ai_summary&sample=1#analyze",
    sampleActionHref: "/?source=comparison_ai_summary&sample=1#analyze",
    sampleGroupSelector: ".comparison-entrance-actions",
  },
  {
    name: "code review interview guide",
    path: "/code-review-interview",
    renderPage: CodeReviewInterviewPage,
    requiredDestinations: [
      "/examples/fastapi-candidate-brief",
      "/repository-walkthrough-interview",
      "/codebase-interview-preparation",
    ],
    primaryActionHref: "/?source=interview_preparation&sample=1#analyze",
    sampleActionHref: "/?source=interview_preparation&sample=1#analyze",
    sampleGroupSelector: ".guide-start-actions",
  },
  {
    name: "FastAPI Candidate Brief example",
    path: "/examples/fastapi-candidate-brief",
    renderPage: FastApiCandidateBriefExamplePage,
    requiredDestinations: [
      "/repository-walkthrough-interview",
      "/?source=fastapi_example&sample=1#analyze",
    ],
    primaryActionHref: null,
    sampleActionHref: "/?source=fastapi_example&sample=1#analyze",
    sampleGroupSelector: ".example-boundary",
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

describe("candidate search surfaces", () => {
  it("covers the exact eight canonical routes", () => {
    expect(clusterPages.map(({ path }) => path)).toEqual([
      "/interview-preparation",
      "/repository-walkthrough-interview",
      "/how-to-walk-through-a-project-in-an-interview",
      "/take-home-coding-interview",
      "/codebase-interview-preparation",
      "/ai-codebase-summary",
      "/code-review-interview",
      "/examples/fastapi-candidate-brief",
    ]);
  });

  it.each(clusterPages)(
    "$path keeps one guided-sample action inside its existing link group",
    async ({ renderPage, sampleActionHref, sampleGroupSelector }) => {
      render(await renderPage());

      const sampleActions = screen.getAllByRole("link").filter((link) =>
        link.getAttribute("href")?.includes("sample=1"),
      );
      expect(sampleActions).toHaveLength(1);
      expect(sampleActions[0]).toHaveAccessibleName("Open the sample Candidate Brief");
      expect(sampleActions[0]).toHaveAttribute("href", sampleActionHref);
      expect(document.querySelector(sampleGroupSelector)).toContainElement(sampleActions[0]);
    },
  );
});
