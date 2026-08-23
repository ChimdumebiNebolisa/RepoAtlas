import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import capturedOutput from "@/data/examples/p-limit-candidate-brief.json";
import sitemap from "../../sitemap";
import PLimitJavascriptCandidateBriefExamplePage, { metadata } from "./page";

const canonicalUrl =
  "https://repo-atlas-phi.vercel.app/examples/p-limit-javascript-candidate-brief";
const repositoryUrl = "https://github.com/sindresorhus/p-limit";
const commit = "df476048d023ff868cd45b35ee47f5fb0ca2b25a";
const sourceBaseUrl = `${repositoryUrl}/blob/${commit}/`;

afterEach(cleanup);

describe("p-limit Candidate Brief example", () => {
  it("publishes a self-canonical exact-commit example", () => {
    expect(metadata.title).toBe("p-limit JavaScript Candidate Brief Example | RepoAtlas");
    expect(metadata.alternates).toEqual({ canonical: canonicalUrl });
    expect(metadata.openGraph).toMatchObject({ type: "article", url: canonicalUrl });
    expect(sitemap()).toContainEqual({
      url: canonicalUrl,
      changeFrequency: "monthly",
      priority: 0.7,
    });
  });

  it("renders all eight sections, one primary action, and only pinned source evidence", () => {
    render(<PLimitJavascriptCandidateBriefExamplePage />);

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
      "/?source=p_limit_example#analyze",
    );
    expect(screen.getAllByRole("link", { name: "index.d.ts" })[0]).toHaveAttribute(
      "href",
      `${sourceBaseUrl}index.d.ts`,
    );

    const evidenceWithPaths = capturedOutput.candidate_brief.evidence_refs.filter(
      (evidence) => evidence.path,
    );
    const pinnedLinks = screen
      .getAllByRole("link")
      .filter((link) => link.getAttribute("href")?.startsWith(sourceBaseUrl));

    expect(evidenceWithPaths).toHaveLength(18);
    expect(new Set(evidenceWithPaths.map((evidence) => evidence.path))).toHaveLength(9);
    expect(pinnedLinks).toHaveLength(evidenceWithPaths.length);
    expect(pinnedLinks.every((link) => link.getAttribute("href")?.startsWith(sourceBaseUrl))).toBe(
      true,
    );
  });
});
