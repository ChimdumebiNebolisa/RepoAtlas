import { cleanup, render, screen } from "@testing-library/react";
import type { ReactElement } from "react";
import { afterEach, describe, expect, it } from "vitest";
import AiCodebaseSummaryPage from "./ai-codebase-summary/page";
import CodebaseInterviewPreparationPage from "./codebase-interview-preparation/page";
import AuthoredProjectWalkthroughPage from "./how-to-walk-through-a-project-in-an-interview/page";
import RepositoryWalkthroughInterviewPage from "./repository-walkthrough-interview/page";

type ClusterPage = {
  name: string;
  renderPage: () => ReactElement | Promise<ReactElement>;
  requiredDestinations: string[];
};

const primaryActionHref = "/?source=interview_preparation#analyze";

const clusterPages: ClusterPage[] = [
  {
    name: "repository walkthrough guide",
    renderPage: RepositoryWalkthroughInterviewPage,
    requiredDestinations: ["/codebase-interview-preparation", "/ai-codebase-summary"],
  },
  {
    name: "authored project guide",
    renderPage: AuthoredProjectWalkthroughPage,
    requiredDestinations: ["/codebase-interview-preparation", "/ai-codebase-summary"],
  },
  {
    name: "structured preparation comparison",
    renderPage: CodebaseInterviewPreparationPage,
    requiredDestinations: [
      "/repository-walkthrough-interview",
      "/how-to-walk-through-a-project-in-an-interview",
    ],
  },
  {
    name: "AI summary comparison",
    renderPage: AiCodebaseSummaryPage,
    requiredDestinations: [
      "/repository-walkthrough-interview",
      "/how-to-walk-through-a-project-in-an-interview",
    ],
  },
];

afterEach(cleanup);

describe.each(clusterPages)("$name", ({ renderPage, requiredDestinations }) => {
  it("keeps both reciprocal cluster destinations and one primary sample action", async () => {
    render(await renderPage());

    const links = screen.getAllByRole("link");
    for (const destination of requiredDestinations) {
      expect(links.some((link) => link.getAttribute("href") === destination)).toBe(true);
    }

    const primaryActions = links.filter((link) => link.classList.contains("btn-primary"));
    expect(primaryActions).toHaveLength(1);
    expect(primaryActions[0]).toHaveAttribute("href", primaryActionHref);
  });
});
