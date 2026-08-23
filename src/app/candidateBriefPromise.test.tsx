import { cleanup, render } from "@testing-library/react";
import type { ReactElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { HomepageHero } from "@/components/HomepageProofSections";
import { buildSampleReport } from "@/lib/buildSampleReport";
import {
  candidateBriefHomepagePromise,
  candidateBriefProofPromise,
} from "@/lib/candidateBriefContent";
import CodeReviewInterviewPage from "./code-review-interview/page";
import AuthoredProjectWalkthroughPage from "./how-to-walk-through-a-project-in-an-interview/page";
import InterviewPreparationPage from "./interview-preparation/page";
import RepositoryWalkthroughInterviewPage from "./repository-walkthrough-interview/page";
import TakeHomeCodingInterviewPage from "./take-home-coding-interview/page";

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
  {
    name: "take-home coding interview guide",
    renderSurface: TakeHomeCodingInterviewPage,
  },
];

afterEach(cleanup);

describe.each(candidateSurfaces)("$name", ({ renderSurface }) => {
  it("uses the shared canonical Candidate Brief promise", async () => {
    render(await renderSurface());

    expect(document.body).toHaveTextContent(candidateBriefProofPromise);
  });
});

describe("homepage", () => {
  it("answers the hero question with the homepage promise", () => {
    render(<HomepageHero onGenerateSample={() => undefined} sampleReport={buildSampleReport()} />);

    expect(document.body).toHaveTextContent(candidateBriefHomepagePromise);
    expect(document.body).toHaveTextContent("Walk me through this repository.");
  });
});
