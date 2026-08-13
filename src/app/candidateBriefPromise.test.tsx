import { cleanup, render } from "@testing-library/react";
import type { ReactElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { HomepageHero } from "@/components/HomepageProofSections";
import { buildSampleReport } from "@/lib/buildSampleReport";
import { candidateBriefProofPromise } from "@/lib/candidateBriefContent";
import CodeReviewInterviewPage from "./code-review-interview/page";
import AuthoredProjectWalkthroughPage from "./how-to-walk-through-a-project-in-an-interview/page";
import InterviewPreparationPage from "./interview-preparation/page";
import RepositoryWalkthroughInterviewPage from "./repository-walkthrough-interview/page";

vi.mock("@/lib/productAnalytics", () => ({
  captureProductEvent: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(),
}));

type CandidateSurface = {
  name: string;
  renderSurface: () => ReactElement | Promise<ReactElement>;
};

const candidateSurfaces: CandidateSurface[] = [
  {
    name: "homepage",
    renderSurface: () => (
      <HomepageHero onGenerateSample={() => undefined} sampleReport={buildSampleReport()} />
    ),
  },
  {
    name: "interview preparation page",
    renderSurface: InterviewPreparationPage,
  },
  {
    name: "repository walkthrough guide",
    renderSurface: RepositoryWalkthroughInterviewPage,
  },
  {
    name: "authored project guide",
    renderSurface: AuthoredProjectWalkthroughPage,
  },
  {
    name: "code review interview guide",
    renderSurface: CodeReviewInterviewPage,
  },
];

afterEach(cleanup);

describe.each(candidateSurfaces)("$name", ({ renderSurface }) => {
  it("uses the shared canonical Candidate Brief promise", async () => {
    render(await renderSurface());

    expect(document.body).toHaveTextContent(candidateBriefProofPromise);
  });
});
