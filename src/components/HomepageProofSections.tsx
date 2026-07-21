import type { RefObject } from "react";
import { candidateBriefWalkthroughOutputs } from "@/lib/candidateBriefContent";
import { homepageFaqItems, homepageTrustBoundaries } from "@/lib/homepageContent";
import { buildHomepageSamplePreview } from "@/lib/homepageSamplePreview";
import { reportCapabilityCopy } from "@/lib/reportCapabilities";
import type { Report } from "@/types/report";
import { ReportTabs } from "@/components/ReportTabs";

function Arrow() {
  return <span aria-hidden="true">→</span>;
}

function EvidenceTag({ id, path }: { id: string; path?: string }) {
  return (
    <span className="sample-evidence-tag">
      <span>{id}</span>
      {path && <code>{path}</code>}
    </span>
  );
}

export function HomepageHero({
  onGenerateSample,
  sampleReport,
}: {
  onGenerateSample: () => void;
  sampleReport: Report;
}) {
  const sample = buildHomepageSamplePreview(sampleReport);

  return (
    <section id="top" className="hero page-container">
      <div className="hero-copy">
        <p className="eyebrow">For repository-centered interviews</p>
        <h1>Walk through the repository with file-backed talking points.</h1>
        <p className="hero-description">
          RepoAtlas turns TypeScript/JavaScript, Python, and Java codebases into a Candidate
          Brief that shows where to start, how the architecture fits together, what looks
          risky, and which files support each talking point.
        </p>
        <div className="hero-actions">
          <button className="btn btn-primary" type="button" onClick={onGenerateSample}>
            Try bundled sample <Arrow />
          </button>
          <a className="text-action" href="#analyze">Use your own repository <Arrow /></a>
        </div>
        <p className="hero-microcopy">
          Bundled sample, no upload needed. Deterministic static analysis. No code execution or AI calls.
        </p>
      </div>

      <div className="hero-visual" aria-label="Real bundled Candidate Brief excerpt">
        {sample ? (
          <div className="sample-hero-card" data-testid="sample-hero-card">
            <div className="sample-hero-header">
              <span>Real bundled report</span>
              <span className="brief-status">{sample.confidence} confidence</span>
            </div>
            <div className="sample-hero-repo">
              <span>Candidate Brief</span>
              <code>{sample.repositoryName}</code>
            </div>
            <blockquote>{sample.walkthrough}</blockquote>
            <div className="sample-hero-evidence">
              <span>Read first</span>
              <EvidenceTag
                id={sample.readingStep.evidence?.id ?? "observed path"}
                path={sample.readingStep.path}
              />
            </div>
          </div>
        ) : (
          <div className="sample-hero-card">
            <div className="sample-hero-header">
              <span>Bundled Candidate Brief</span>
              <span className="brief-status">evidence linked</span>
            </div>
            <p>The complete sample report is available from the primary action.</p>
          </div>
        )}
      </div>
    </section>
  );
}

export function HomepageWalkthroughOutcomes() {
  return (
    <section
      className="walkthrough-outcomes page-container"
      aria-labelledby="walkthrough-outcomes-heading"
      data-testid="walkthrough-outcomes"
    >
      <header className="walkthrough-outcomes-header">
        <div>
          <p className="section-kicker">Inside the brief</p>
          <h2 id="walkthrough-outcomes-heading">Four answers for the repository walkthrough.</h2>
        </div>
        <p className="walkthrough-export-note">
          <span aria-hidden="true">&#10003;</span>
          {reportCapabilityCopy.homepageBriefExports}
        </p>
      </header>
      <div className="walkthrough-outcome-list">
        {candidateBriefWalkthroughOutputs.map(({ title, description }, index) => (
          <article key={title}>
            <span aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
            <div>
              <h3>{title}</h3>
              <p>{description}</p>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

type HomepageSampleProofProps = {
  sampleReport: Report;
  showSampleReport: boolean;
  onOpenSample: () => void;
  sectionRef: RefObject<HTMLElement | null>;
};

export function HomepageSampleProof({
  sampleReport,
  showSampleReport,
  onOpenSample,
  sectionRef,
}: HomepageSampleProofProps) {
  const sample = buildHomepageSamplePreview(sampleReport);

  return (
    <section
      id="sample-report"
      ref={sectionRef}
      className="sample-report-section page-container"
      aria-labelledby="sample-proof-heading"
    >
      <div className="sample-report-heading">
        <div>
          <p className="section-kicker">Real bundled output</p>
          <h2 id="sample-proof-heading">See the evidence before you add a repository.</h2>
        </div>
        {!showSampleReport && (
          <button type="button" className="text-action" onClick={onOpenSample}>
            Open sample report <Arrow />
          </button>
        )}
      </div>
      {!showSampleReport ? (
        sample ? (
          <div className="sample-proof-preview" data-testid="homepage-sample-preview">
            <header className="sample-proof-summary">
              <div>
                <span className="sample-proof-label">Plain-English summary</span>
                <span className="brief-status">{sample.confidence} confidence</span>
              </div>
              <p>{sample.summary}</p>
            </header>

            <article className="sample-proof-walkthrough">
              <span className="sample-proof-label">What you can say in 30 seconds</span>
              <blockquote>{sample.walkthrough}</blockquote>
            </article>

            <div className="sample-proof-details">
              <article>
                <span className="sample-proof-label">01 · Start here</span>
                <code className="sample-proof-path">{sample.readingStep.path}</code>
                <p>{sample.readingStep.why}</p>
                {sample.readingStep.evidence && (
                  <EvidenceTag
                    id={sample.readingStep.evidence.id}
                    path={sample.readingStep.evidence.path}
                  />
                )}
              </article>

              <article>
                <span className="sample-proof-label">02 · Explain the architecture</span>
                <p>{sample.architecture.explanation}</p>
                {sample.architecture.evidence && (
                  <EvidenceTag
                    id={sample.architecture.evidence.id}
                    path={sample.architecture.evidence.path}
                  />
                )}
              </article>

              <article>
                <span className="sample-proof-label">03 · Prepare for the follow-up</span>
                <h3>{sample.interviewerQuestion.question}</h3>
                <p>{sample.interviewerQuestion.rationale}</p>
                {sample.interviewerQuestion.evidence && (
                  <EvidenceTag
                    id={sample.interviewerQuestion.evidence.id}
                    path={sample.interviewerQuestion.evidence.path}
                  />
                )}
              </article>
            </div>
          </div>
        ) : (
          <p className="sample-report-copy">
            The bundled report does not contain enough evidence for a walkthrough preview. Open the
            full report to inspect the available repository signals.
          </p>
        )
      ) : (
        <>
          <p className="sample-report-copy">
            Explore the bundled read-only report. PDF and PNG preview exports work here; Markdown
            requires a saved analysis.
          </p>
          <div className="sample-report-shell">
            <ReportTabs report={sampleReport} variant="preview" />
          </div>
        </>
      )}
    </section>
  );
}

export function HomepageTrustAndFaq() {
  return (
    <section id="faq" className="faq-section homepage-trust" aria-labelledby="homepage-trust-heading">
      <div className="page-container faq-layout">
        <header className="faq-intro">
          <p className="section-kicker">Before you upload</p>
          <h2 id="homepage-trust-heading">The useful boundaries stay visible.</h2>
          <p>{reportCapabilityCopy.homepageStorageNote}</p>
          <ul className="trust-boundary-list">
            {homepageTrustBoundaries.map((item) => <li key={item}>{item}</li>)}
          </ul>
          <a href="/privacy" className="faq-privacy-link">
            Read the privacy details <Arrow />
          </a>
        </header>
        <div className="faq-list">
          {homepageFaqItems.map(({ question, answer }) => (
            <details key={question} data-testid="homepage-faq-item">
              <summary>
                <h3>{question}</h3>
              </summary>
              <p>{answer}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
