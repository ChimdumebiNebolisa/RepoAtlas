import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { SiteHeader } from "@/components/SiteHeader";
import { TrackedAnalysisLink } from "@/components/TrackedAnalysisLink";
import {
  candidateBriefProofPromise,
  candidateBriefLanguageCoverage,
  candidateBriefSampleAction,
  candidateBriefWalkthroughOutputs,
} from "@/lib/candidateBriefContent";
import { interviewPreparationMetadata } from "@/lib/interviewPreparationContent";
import { reportCapabilityCopy } from "@/lib/reportCapabilities";

export const metadata: Metadata = {
  title: interviewPreparationMetadata.title,
  description: interviewPreparationMetadata.description,
  alternates: {
    canonical: "https://repo-atlas-phi.vercel.app/interview-preparation",
  },
  openGraph: {
    title: interviewPreparationMetadata.title,
    description: interviewPreparationMetadata.openGraphDescription,
    type: "website",
    url: "https://repo-atlas-phi.vercel.app/interview-preparation",
  },
};

export default function InterviewPreparationPage() {
  return (
    <main className="site-shell interview-page">
      <div className="site-grid" aria-hidden="true" />
      <SiteHeader />

      <section className="interview-hero page-container">
        <div className="interview-hero-copy">
          <p className="eyebrow">Repository interview preparation</p>
          <h1>Prepare to explain your code, file by file.</h1>
          <p className="interview-hero-description">{candidateBriefProofPromise}</p>
          <Suspense
            fallback={
              <Link
                className="btn btn-primary interview-primary-action"
                href="/?source=interview_preparation&sample=1#analyze"
              >
                {candidateBriefSampleAction} <span aria-hidden="true">→</span>
              </Link>
            }
          >
            <TrackedAnalysisLink startSample>{candidateBriefSampleAction}</TrackedAnalysisLink>
          </Suspense>
          <p className="interview-hero-note">
            Start with the bundled sample, a public GitHub URL, or a ZIP. RepoAtlas reads files
            without executing code or calling AI.
          </p>
        </div>

        <div className="candidate-moment" aria-label="Example technical interview moment">
          <div className="candidate-moment-header">
            <span>Technical interview</span>
            <span className="candidate-moment-time">Tomorrow · 10:00</span>
          </div>
          <blockquote>&quot;Walk me through this repository. Where would you start?&quot;</blockquote>
          <div className="candidate-answer-path">
            <span>Answer from evidence</span>
            <ol>
              <li><code>src/app/(homepage)/page.tsx</code><small>application entry</small></li>
              <li><code>src/app/api/analyze/route.ts</code><small>analysis boundary</small></li>
              <li><code>src/analyzer/pipeline.ts</code><small>core workflow</small></li>
            </ol>
          </div>
          <p>Candidate Brief · reading path</p>
        </div>
      </section>

      <section className="interview-method page-container" aria-labelledby="interview-method-heading">
        <header>
          <p className="section-kicker">How to answer the walkthrough question</p>
          <h2 id="interview-method-heading">Start with the route you can prove.</h2>
          <p>
            When an interviewer says, &quot;Walk me through this repository,&quot; build the answer in
            four passes. Keep each claim tied to a file, configuration value, or supported
            relationship.
          </p>
          <Link className="interview-example-link" href="/examples/fastapi-candidate-brief">
            Inspect the exact-commit FastAPI Candidate Brief <span aria-hidden="true">→</span>
          </Link>
        </header>

        <ol aria-label="Evidence-first repository walkthrough method">
          <li>
            <span>01</span>
            <div>
              <h3>Identify entry points.</h3>
              <p>Find the files and configuration that show where the system starts.</p>
            </div>
          </li>
          <li>
            <span>02</span>
            <div>
              <h3>Establish a reading order.</h3>
              <p>Follow the main path from the entry point into the next meaningful boundary.</p>
            </div>
          </li>
          <li>
            <span>03</span>
            <div>
              <h3>Inspect architecture and risk signals.</h3>
              <p>Use supported connections and structural signals to choose what to inspect next.</p>
            </div>
          </li>
          <li>
            <span>04</span>
            <div>
              <h3>Prepare file-backed talking points.</h3>
              <p>Explain what the evidence shows, then name what the repository cannot prove.</p>
            </div>
          </li>
        </ol>
      </section>

      <section className="interview-outcome page-container">
        <header>
          <p className="section-kicker">What you take into the conversation</p>
          <h2>A technical story you can point back to.</h2>
          <p>
            RepoAtlas turns detected repository signals into 30-second and 2-minute walkthroughs.
            It does not invent business logic, assert bugs, or claim what the code cannot prove.
          </p>
          <Link className="interview-example-link" href="/code-review-interview">
            Practice code review interview questions with a worked example{" "}
            <span aria-hidden="true">→</span>
          </Link>
        </header>

        <div className="interview-brief-list">
          {candidateBriefWalkthroughOutputs.map((section, index) => (
            <article key={section.title}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <div>
                <h3>{section.title}</h3>
                <p>{section.description}</p>
              </div>
            </article>
          ))}
          <p className="interview-capability-note">{reportCapabilityCopy.homepageStorageNote}</p>
        </div>
      </section>

      <section className="interview-proof-band">
        <div className="page-container interview-proof-layout">
          <p>Built for a high-pressure code conversation.</p>
          <ul aria-label="Candidate Brief safeguards">
            <li>Deterministic static analysis</li>
            <li>Deeper {candidateBriefLanguageCoverage} analysis</li>
            <li>Confidence gaps stay visible</li>
          </ul>
        </div>
      </section>
    </main>
  );
}
