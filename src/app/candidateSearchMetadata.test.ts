import type { Metadata } from "next";
import { describe, expect, it } from "vitest";
import { metadata as aiCodebaseSummaryMetadata } from "./ai-codebase-summary/page";
import { metadata as codeReviewMetadata } from "./code-review-interview/page";
import { metadata as codebasePreparationMetadata } from "./codebase-interview-preparation/page";
import { metadata as fastApiExampleMetadata } from "./examples/fastapi-candidate-brief/page";
import { metadata as authoredProjectMetadata } from "./how-to-walk-through-a-project-in-an-interview/page";
import { metadata as interviewPreparationMetadata } from "./interview-preparation/page";
import { metadata as repositoryWalkthroughMetadata } from "./repository-walkthrough-interview/page";
import { metadata as takeHomeMetadata } from "./take-home-coding-interview/page";

const candidateEntrances = [
  {
    path: "/interview-preparation",
    metadata: interviewPreparationMetadata,
    intent: ["repository interview", "Candidate Brief"],
  },
  {
    path: "/repository-walkthrough-interview",
    metadata: repositoryWalkthroughMetadata,
    intent: ["repository walkthrough interview", "ranked reading path"],
  },
  {
    path: "/how-to-walk-through-a-project-in-an-interview",
    metadata: authoredProjectMetadata,
    intent: ["personal project interview walkthrough", "contribution"],
  },
  {
    path: "/take-home-coding-interview",
    metadata: takeHomeMetadata,
    intent: ["take-home coding assignment", "five-pass"],
  },
  {
    path: "/codebase-interview-preparation",
    metadata: codebasePreparationMetadata,
    intent: ["ad hoc repository browsing", "evidence-first codebase interview workflow"],
  },
  {
    path: "/ai-codebase-summary",
    metadata: aiCodebaseSummaryMetadata,
    intent: ["AI codebase summary", "source traceability"],
  },
  {
    path: "/code-review-interview",
    metadata: codeReviewMetadata,
    intent: ["code review interview questions", "worked TypeScript example"],
  },
  {
    path: "/examples/fastapi-candidate-brief",
    metadata: fastApiExampleMetadata,
    intent: ["exact-commit FastAPI Candidate Brief", "source-linked evidence"],
  },
] satisfies ReadonlyArray<{
  path: string;
  metadata: Metadata;
  intent: readonly string[];
}>;

const readMetadataText = (value: Metadata["title"] | Metadata["description"]) => {
  expect(typeof value).toBe("string");
  return value as string;
};

describe("candidate search metadata", () => {
  it("covers exactly the seven candidate entrances and the FastAPI proof page", () => {
    expect(candidateEntrances.map(({ path }) => path)).toEqual([
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

  it("keeps every search title and description distinct and result-sized", () => {
    const titles = candidateEntrances.map(({ metadata }) => readMetadataText(metadata.title));
    const descriptions = candidateEntrances.map(({ metadata }) =>
      readMetadataText(metadata.description),
    );

    expect(new Set(titles)).toHaveLength(candidateEntrances.length);
    expect(new Set(descriptions)).toHaveLength(candidateEntrances.length);

    for (const title of titles) {
      expect(title.length).toBeLessThanOrEqual(60);
    }
    for (const description of descriptions) {
      expect(description.length).toBeGreaterThanOrEqual(120);
      expect(description.length).toBeLessThanOrEqual(160);
      expect(description.toLowerCase()).not.toContain("pricing");
    }
  });

  it.each(candidateEntrances)("matches the distinct search intent for $path", ({ metadata, intent }) => {
    const searchCopy = `${readMetadataText(metadata.title)} ${readMetadataText(metadata.description)}`;

    for (const phrase of intent) {
      expect(searchCopy).toContain(phrase);
    }
  });

  it.each(candidateEntrances)("keeps $path self-canonical and indexable", ({ path, metadata }) => {
    expect(metadata.alternates).toEqual({
      canonical: `https://repo-atlas-phi.vercel.app${path}`,
    });
    expect(metadata.robots).toBeUndefined();
  });
});
