import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import capturedOutput from "@/data/examples/spring-petclinic-candidate-brief.json";
import sitemap from "../../sitemap";
import SpringPetclinicCandidateBriefExamplePage, { metadata } from "./page";

const canonicalUrl =
  "https://repo-atlas-phi.vercel.app/examples/spring-petclinic-candidate-brief";
const repositoryUrl = "https://github.com/spring-projects/spring-petclinic";
const commit = "88e37c15cf6fc8490b01bc3e8e2c800cec1ac272";
const sourceBaseUrl = `${repositoryUrl}/blob/${commit}/`;

afterEach(cleanup);

describe("Spring Petclinic Candidate Brief example", () => {
  it("publishes a self-canonical exact-commit example", () => {
    expect(metadata.title).toBe("Spring Petclinic Java Candidate Brief Example | RepoAtlas");
    expect(metadata.alternates).toEqual({ canonical: canonicalUrl });
    expect(metadata.openGraph).toMatchObject({ type: "article", url: canonicalUrl });
    expect(sitemap()).toContainEqual({
      url: canonicalUrl,
      changeFrequency: "monthly",
      priority: 0.7,
    });
  });

  it("renders all eight sections, one primary action, and only pinned source evidence", () => {
    render(<SpringPetclinicCandidateBriefExamplePage />);

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
      "/?source=spring_petclinic_example#analyze",
    );
    expect(
      screen.getAllByRole("link", {
        name: "src/main/java/org/springframework/samples/petclinic/PetClinicApplication.java",
      })[0],
    ).toHaveAttribute(
      "href",
      `${sourceBaseUrl}src/main/java/org/springframework/samples/petclinic/PetClinicApplication.java`,
    );

    const expectedPinnedLinks = capturedOutput.candidate_brief.evidence_refs.filter(
      (evidence) => evidence.path,
    ).length;
    const pinnedLinks = screen
      .getAllByRole("link")
      .filter((link) => link.getAttribute("href")?.startsWith(sourceBaseUrl));

    expect(expectedPinnedLinks).toBe(47);
    expect(pinnedLinks).toHaveLength(expectedPinnedLinks);
    expect(pinnedLinks.every((link) => link.getAttribute("href")?.startsWith(sourceBaseUrl))).toBe(
      true,
    );
  });
});
