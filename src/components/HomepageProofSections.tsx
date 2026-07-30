import type { RefObject } from "react";
import { candidateBriefWalkthroughOutputs } from "@/lib/candidateBriefContent";
import {
  homepageFaqItems,
  homepageInterviewGuides,
  homepageSupportedWorkflows,
  homepageTrustBoundaries,
} from "@/lib/homepageContent";
import { buildHomepageSamplePreview } from "@/lib/homepageSamplePreview";
import { reportCapabilityCopy } from "@/lib/reportCapabilities";
import type { Report } from "@/types/report";
import { ReportTabs } from "@/components/ReportTabs";
import type { HomepageFaqItem } from "@/lib/homepageContent";

function Arrow() {
  return <span aria-hidden="true">→</span>;
}

function EvidenceTag({ path }: { path: string }) {
  return (
    <span className="sample-evidence-tag">
      <span>File citation</span>
      <code>{path}</code>
    </span>
  );
}

function HomepageFaqAnswer({ answer, link }: Pick<HomepageFaqItem, "answer" | "link">) {
  if (!link) {
    return <p>{answer}</p>;
  }

  const linkStart = answer.indexOf(link.label);

  if (linkStart < 0) {
    return <p>{answer}</p>;
  }

  return (
    <p>
      {answer.slice(0, linkStart)}
      <a href={link.href}>{link.label}</a>
      {answer.slice(linkStart + link.label.length)}
    </p>
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
        <h1>Understand unfamiliar repositories fast.</h1>
        <p className="hero-description">
          Before an interview or onboarding, turn a public GitHub repository or ZIP into a
          file-cited brief without running its code.
        </p>
        <div className="hero-actions">
          <button className="btn btn-primary" type="button" onClick={onGenerateSample}>
            Generate sample brief <Arrow />
          </button>
          <a className="text-action" href="#analyze">
            Analyze your repository <Arrow />
          </a>
        </div>
      </div>

      <div className="hero-visual" aria-label="Example file-cited repository brief">
        <div className="sample-hero-card" data-testid="hero-output-card">
          <div className="sample-hero-header">
            <div>
              <span>Bundled sample</span>
              <strong>{sample?.repositoryName ?? "Repository brief"}</strong>
            </div>
            <span className="brief-status">files cited</span>
          </div>
          {sample ? (
            <>
              <div className="sample-hero-summary">
                <div>
                  <span>Repository purpose</span>
                  <span className="brief-status">{sample.confidence} confidence</span>
                </div>
                <p>{sample.purpose}</p>
              </div>
              <div className="sample-hero-details">
                <article>
                  <span>Start here</span>
                  <code>{sample.readingStep.path}</code>
                  <small>{sample.readingStep.why}</small>
                </article>
                <article>
                  <span>Detected connection</span>
                  <p>{sample.architecture.connection}</p>
                </article>
              </div>
              <div className="sample-hero-evidence">
                <span>Evidence</span>
                <p>Conclusions cite repository files.</p>
              </div>
            </>
          ) : (
            <p className="sample-hero-fallback">
              Purpose, key files, connections, and citations.
            </p>
          )}
        </div>
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
          <h2 id="walkthrough-outcomes-heading">What your repository brief includes.</h2>
        </div>
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

export function HomepageSupportedWorkflows() {
  return (
    <section
      className="walkthrough-outcomes homepage-workflows page-container"
      aria-labelledby="supported-workflows-heading"
      data-testid="supported-workflows"
    >
      <header className="walkthrough-outcomes-header">
        <div>
          <p className="section-kicker">Use RepoAtlas when…</p>
          <h2 id="supported-workflows-heading">Before you explain or change unfamiliar code.</h2>
        </div>
      </header>
      <div className="walkthrough-outcome-list">
        {homepageSupportedWorkflows.map(({ title, description }, index) => (
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
          <h2 id="sample-proof-heading">See a complete sample brief.</h2>
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
                <span className="sample-proof-label">Repository purpose</span>
                <span className="brief-status">{sample.confidence} confidence</span>
              </div>
              <p>{sample.purpose}</p>
            </header>

            <div className="sample-proof-details">
              <article>
                <span className="sample-proof-label">Start here</span>
                <code className="sample-proof-path">{sample.readingStep.path}</code>
                <p>{sample.readingStep.why}</p>
                {sample.readingStep.evidence?.path && (
                  <EvidenceTag path={sample.readingStep.evidence.path} />
                )}
              </article>

              <article>
                <span className="sample-proof-label">Connection to inspect</span>
                <p>{sample.architecture.connection}</p>
                {sample.architecture.evidence?.path && (
                  <EvidenceTag path={sample.architecture.evidence.path} />
                )}
              </article>

            </div>
          </div>
        ) : (
          <p className="sample-report-copy">
            This sample lacks enough evidence for a preview. Open the report to see its confidence
            gaps.
          </p>
        )
      ) : (
        <>
          <p className="sample-report-copy">
            Explore the read-only sample. PDF and PNG previews work here; Markdown requires a saved
            analysis.
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
          <p className="section-kicker">Trust and privacy</p>
          <h2 id="homepage-trust-heading">What RepoAtlas reads and what it cannot know.</h2>
          <p>{reportCapabilityCopy.homepageStorageNote}</p>
          <ul className="trust-boundary-list">
            {homepageTrustBoundaries.map((item) => <li key={item}>{item}</li>)}
          </ul>
          <a href="/privacy" className="faq-privacy-link">
            Read the privacy details <Arrow />
          </a>
        </header>
        <div className="faq-list">
          {homepageFaqItems.map(({ question, answer, link }) => (
            <details key={question} data-testid="homepage-faq-item">
              <summary>
                <h3>{question}</h3>
              </summary>
              <HomepageFaqAnswer answer={answer} link={link} />
            </details>
          ))}
        </div>
      </div>
      <nav
        className="page-container homepage-guide-nav"
        aria-labelledby="homepage-guide-nav-heading"
      >
        <div className="homepage-guide-intro">
          <h3 id="homepage-guide-nav-heading">Prepare to explain a repository.</h3>
          <p>Choose the guide that matches the codebase and conversation.</p>
        </div>
        {homepageInterviewGuides.map(({ title, description, href }) => (
          <a key={href} href={href} className="homepage-guide-link" aria-label={title}>
            <span>
              <strong>{title}</strong>
              <small>{description}</small>
            </span>
            <Arrow />
          </a>
        ))}
      </nav>
    </section>
  );
}
