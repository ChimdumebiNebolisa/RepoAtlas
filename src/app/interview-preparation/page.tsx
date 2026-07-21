import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { SiteHeader } from "@/components/SiteHeader";
import { TrackedAnalysisLink } from "@/components/TrackedAnalysisLink";
import {
  candidateBriefLanguageCoverage,
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
          <p className="interview-hero-description">
            When the conversation turns to your repository, use a Candidate Brief to find likely
            entry points, follow a reading order, map the architecture, and inspect risk signals
            with file-backed talking points.
          </p>
          <Suspense
            fallback={
              <Link
                className="btn btn-primary interview-primary-action"
                href="/?source=interview_preparation#analyze"
              >
                Prepare my Candidate Brief <span aria-hidden="true">→</span>
              </Link>
            }
          >
            <TrackedAnalysisLink>Prepare my Candidate Brief</TrackedAnalysisLink>
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

      <section className="interview-outcome page-container">
        <header>
          <p className="section-kicker">What you take into the conversation</p>
          <h2>A technical story you can point back to.</h2>
          <p>
            RepoAtlas turns detected repository signals into 30-second and 2-minute walkthroughs.
            It does not invent business logic, assert bugs, or claim what the code cannot prove.
          </p>
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
