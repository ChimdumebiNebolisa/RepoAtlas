import { describe, expect, it } from "vitest";
import sitemap from "../sitemap";
import { metadata } from "./page";

const canonicalUrl = "https://repo-atlas-phi.vercel.app/repository-walkthrough-interview";
const description =
  "Prepare for a repository walkthrough interview with a Candidate Brief that gives you a ranked reading path backed by repository files.";

describe("repository walkthrough interview guide", () => {
  it("publishes a specific, self-canonical search entrance", () => {
    expect(metadata.title).toBe("Repository Walkthrough Interview Guide | RepoAtlas");
    expect(metadata.description).toBe(description);
    expect(metadata.alternates).toEqual({ canonical: canonicalUrl });
    expect(metadata.openGraph).toMatchObject({ type: "article", url: canonicalUrl });
    expect(metadata.robots).toBeUndefined();
    expect(sitemap()).toContainEqual({
      url: canonicalUrl,
      changeFrequency: "monthly",
      priority: 0.8,
    });
  });
});
