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

function EvidenceTag({ id, path }: { id: string; path?: string }) {
  return (
    <span className="sample-evidence-tag">
      <span>{id}</span>
      {path && <code>{path}</code>}
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
}: {
  onGenerateSample: () => void;
}) {
  return (
    <section id="top" className="hero page-container">
      <div className="hero-copy">
        <p className="eyebrow">For interviews, onboarding, debugging, and design discussions</p>
        <h1>Understand an unfamiliar repository before you need to explain or change it.</h1>
        <p className="hero-description">
          Paste a public GitHub URL or upload a ZIP for a TypeScript/JavaScript, Python, or Java
          repository. RepoAtlas reads the files without running the code and returns a source-linked
          brief: what the repository appears to do, where the important code lives, how supported
          parts and dependencies connect, and what to inspect next.
        </p>
        <div className="hero-actions">
          <button className="btn btn-primary" type="button" onClick={onGenerateSample}>
            Generate a sample repository brief <Arrow />
          </button>
          <a className="text-action" href="#analyze">
            Paste a GitHub URL or upload a ZIP <Arrow />
          </a>
        </div>
        <p className="hero-microcopy">
          Deterministic static analysis, not a generic AI summary. Repository code is read as text,
          never run, and never sent to an AI service.
        </p>
      </div>

      <div className="hero-visual" aria-label="Source-linked repository brief outline">
        <div className="sample-hero-card" data-testid="hero-output-card">
          <div className="sample-hero-header">
            <span>Repository brief</span>
            <span className="brief-status">linked to source files</span>
          </div>
          <div className="sample-hero-repo">
            <span>Static file analysis</span>
            <code>key conclusions cite files</code>
          </div>
          <blockquote>
            Purpose · important files · architecture and dependencies · inspection points and
            questions
          </blockquote>
          <div className="sample-hero-evidence">
            <span>Repository handling</span>
            <EvidenceTag id="files are read, not run" path="no AI service" />
          </div>
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
          <p className="section-kicker">The deliverable</p>
          <h2 id="walkthrough-outcomes-heading">
            RepoAtlas calls it a Candidate Brief: a source-linked repository brief.
          </h2>
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
          <p className="section-kicker">Four supported workflows</p>
          <h2 id="supported-workflows-heading">
            Use the walkthrough for the conversation in front of you.
          </h2>
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
          <p className="section-kicker">
            Bundled sample{sample ? ` · ${sample.repositoryName}` : ""}
          </p>
          <h2 id="sample-proof-heading">
            See the purpose, key files, connections, evidence, and next questions.
          </h2>
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
                <span className="sample-proof-label">02 · Detected connection to inspect</span>
                <p>{sample.architecture.explanation}</p>
                {sample.architecture.evidence && (
                  <EvidenceTag
                    id={sample.architecture.evidence.id}
                    path={sample.architecture.evidence.path}
                  />
                )}
              </article>

            </div>
          </div>
        ) : (
          <p className="sample-report-copy">
            The bundled report does not contain enough evidence for this repository brief preview.
            Open the full report to inspect the available signals and confidence gaps.
          </p>
        )
      ) : (
        <>
          <p className="sample-report-copy">
            Explore the bundled read-only repository brief. PDF and PNG preview exports work here;
            Markdown requires a saved analysis.
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
          <h2 id="homepage-trust-heading">Explicit boundaries before you rely on the brief.</h2>
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
          <p className="section-kicker">Interview guides</p>
          <h3 id="homepage-guide-nav-heading">Prepare for the walkthrough question.</h3>
          <p>Choose the guide that matches the repository you need to explain.</p>
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
