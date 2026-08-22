import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import sitemap from "../../sitemap";
import ClickCandidateBriefExamplePage, { metadata } from "./page";

const canonicalUrl = "https://repo-atlas-phi.vercel.app/examples/click-candidate-brief";
const commit = "2c8cd3ac958a7eb316d67f2d316c27086c4c0369";

afterEach(cleanup);

describe("Click Candidate Brief example", () => {
  it("publishes a self-canonical exact-commit example", () => {
    expect(metadata.title).toBe("Click Python Candidate Brief Example | RepoAtlas");
    expect(metadata.alternates).toEqual({ canonical: canonicalUrl });
    expect(metadata.openGraph).toMatchObject({ type: "article", url: canonicalUrl });
    expect(sitemap()).toContainEqual({
      url: canonicalUrl,
      changeFrequency: "monthly",
      priority: 0.7,
    });
  });

  it("renders all eight sections, one primary action, and pinned source evidence", () => {
    render(<ClickCandidateBriefExamplePage />);

    for (const heading of [
      "Repo Summary",
      "Walkthrough Script",
      "Reading Path",
      "System Flow",
      "Interview Talking Points",
      "Interview Questions",
      "First PR Plan",
      "Evidence",
    ]) {
      expect(screen.getByRole("heading", { name: heading })).toBeInTheDocument();
    }

    expect(screen.getByText(commit)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Analyze your repository" })).toHaveAttribute(
      "href",
      "/?source=click_example#analyze"
    );
    expect(screen.getByRole("link", { name: "src/click/core.py" })).toHaveAttribute(
      "href",
      `https://github.com/pallets/click/blob/${commit}/src/click/core.py`
    );
  });
});
