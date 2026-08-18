import type { Metadata } from "next";
import { SiteHeader } from "@/components/SiteHeader";
import { CodeReviewExercise } from "./CodeReviewExercise";
import { CodeReviewHero } from "./CodeReviewHero";
import { CodeReviewMethod } from "./CodeReviewMethod";
import { CodeReviewPreparation } from "./CodeReviewPreparation";

const canonicalUrl = "https://repo-atlas-phi.vercel.app/code-review-interview";

export const metadata: Metadata = {
  title: "Code Review Interview Questions and Example Answers | RepoAtlas",
  description:
    "Practice code review interview questions with a worked TypeScript example, prioritized comments, answer frameworks, and a 45-minute preparation method.",
  alternates: { canonical: canonicalUrl },
  openGraph: {
    title: "Code Review Interview Questions and Example Answers | RepoAtlas",
    description:
      "Ten code review interview questions, a worked TypeScript exercise, and an evidence-first method for explaining priorities and tradeoffs.",
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
