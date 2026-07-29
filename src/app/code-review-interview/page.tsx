import type { Metadata } from "next";
import { SiteHeader } from "@/components/SiteHeader";
import { CodeReviewExercise } from "./CodeReviewExercise";
import { CodeReviewHero } from "./CodeReviewHero";
import { CodeReviewMethod } from "./CodeReviewMethod";
import { CodeReviewPreparation } from "./CodeReviewPreparation";

const canonicalUrl = "https://repo-atlas-phi.vercel.app/code-review-interview";

export const metadata: Metadata = {
  title: "Code Review Interview Examples and Preparation Guide | RepoAtlas",
  description:
    "Practice code review interview examples with an evidence-first checklist, sample comments, and a clear way to explain priorities and tradeoffs.",
  alternates: { canonical: canonicalUrl },
  openGraph: {
    title: "Code Review Interview Examples and Preparation Guide | RepoAtlas",
    description:
      "A practical, evidence-first method for finding, prioritizing, and explaining code review feedback in an interview.",
    type: "article",
    url: canonicalUrl,
  },
};

export default function CodeReviewInterviewPage() {
  return (
    <main className="site-shell guide-page">
      <div className="site-grid" aria-hidden="true" />
      <SiteHeader />

      <article>
        <CodeReviewHero />
        <CodeReviewMethod />
        <CodeReviewExercise />
        <CodeReviewPreparation />
      </article>
    </main>
  );
}
