import type { RefObject } from "react";
import { candidateBriefWalkthroughOutputs } from "@/lib/candidateBriefContent";
import { homepageFaqItems, homepageTrustBoundaries } from "@/lib/homepageContent";
import { reportCapabilityCopy } from "@/lib/reportCapabilities";
import type { Report } from "@/types/report";
import { ReportTabs } from "@/components/ReportTabs";

function Arrow() {
  return <span aria-hidden="true">→</span>;
}

export function HomepageHero({ onGenerateSample }: { onGenerateSample: () => void }) {
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

      <div className="hero-visual" aria-label="Candidate Brief output overview">
        <div className="brief-sheet">
          <div className="brief-sheet-header">
            <span>Candidate Brief</span>
            <span className="brief-status">evidence linked</span>
          </div>
          <div className="brief-sheet-title">repo-atlas</div>
          <div className="brief-reading-path">
            <span>Read first</span>
            <code>src/analyzer/index.ts</code>
            <code>src/analyzer/scoring.ts</code>
            <code>src/components/ReportTabs.tsx</code>
          </div>
          <div className="brief-sheet-footer">
            <span>Reading path</span>
            <span>Risk signals</span>
            <span>Talking points</span>
          </div>
        </div>
        <div className="evidence-card">
          <span className="evidence-card-label">Claim</span>
          <strong>Every conclusion points back to repository evidence.</strong>
          <span className="evidence-ref">source / path / signal</span>
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
        <div className="sample-proof-preview">
          <p className="sample-report-copy">
            This read-only Candidate Brief comes from the bundled repository. Its paths,
            architecture count, and risk signals come from the same analysis shown in the full report.
          </p>
          <div className="brief-sheet sample-proof-sheet">
            <div className="brief-sheet-header">
              <span>Candidate Brief</span>
              <span className="brief-status">sample</span>
            </div>
            <div className="brief-sheet-title">{sampleReport.repo_metadata.name}</div>
            <div className="brief-reading-path">
              <span>Read first</span>
              {sampleReport.start_here.slice(0, 3).map((item) => (
                <code key={item.path}>{item.path}</code>
              ))}
            </div>
            <div className="brief-sheet-footer">
              <span>{sampleReport.start_here.length} start-here paths</span>
              <span>{sampleReport.danger_zones.length} risk signals</span>
              <span>{sampleReport.architecture.nodes.length} architecture nodes</span>
            </div>
          </div>
        </div>
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
