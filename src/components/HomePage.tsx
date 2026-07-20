"use client";

import { useRef, useState } from "react";
import { InputForm } from "@/components/InputForm";
import { ReportTabs } from "@/components/ReportTabs";
import { homepageFaqItems } from "@/lib/homepageContent";
import { clientMaxZipMbLabel } from "@/lib/ingestLimitsClient";
import { reportCapabilityCopy } from "@/lib/reportCapabilities";
import type { Report } from "@/types/report";

const projectTypes = [
  ["Next.js app", "TSX", "Routes, components, imports, run commands, and likely entry points."],
  ["Python API", "PY", "Modules, endpoints, imports, tests, and detected launch commands."],
  ["Java service", "JVM", "Packages, entry points, dependency edges, tests, and build commands."],
  ["Monorepo", "PKG", "Workspace boundaries, package relationships, and cross-package signals."],
  ["Docs-only repo", "MD", "Documentation structure, contribution guidance, and available evidence."],
  ["No README repo", "∅", "Source-led reading paths with explicit confidence gaps."],
];

const interviewerFeatures = [
  ["Understand the structure", "See the repository as systems and boundaries, not a flat file list."],
  ["Find the files to read first", "Follow a ranked path based on entry points, imports, and repository signals."],
  ["Identify risky areas", "Review structural hotspots without treating the score as a bug count."],
  ["Extract run and contribution commands", "Collect commands and contribution cues already present in the repository."],
  ["Prepare technical talking points", "Turn detected signals into specific prompts for an interview walkthrough."],
  ["Link every claim back to evidence", "Trace conclusions to files, paths, snippets, and detected metadata."],
];

const briefContents = [
  "Repo summary",
  "Reading path",
  "Walkthrough script",
  "Interview talking points",
  "First PR plan",
  "Resume / LinkedIn bullets",
  "Evidence index",
  "Confidence notes",
];

const guardrails = [
  "Does not execute uploaded code",
  "Does not call AI",
  "Does not claim production readiness",
  "Does not assert bugs or vulnerabilities",
  "Does not infer business purpose without evidence",
  "Danger Zones are structural risk signals, not bug counts",
];

function Badge({ children }: { children: React.ReactNode }) {
  return <span className="badge">{children}</span>;
}

function Arrow() {
  return <span aria-hidden="true">→</span>;
}

export function HomePage({ sampleReport }: { sampleReport: Report }) {
  const [report, setReport] = useState<Report | null>(null);
  const [reportId, setReportId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showViewReportButton, setShowViewReportButton] = useState(false);
  const [showSampleReport, setShowSampleReport] = useState(false);
  const reportSectionRef = useRef<HTMLElement | null>(null);
  const sampleButtonRef = useRef<HTMLButtonElement | null>(null);
  const sampleSectionRef = useRef<HTMLElement | null>(null);

  const scrollToReport = () => {
    reportSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    setShowViewReportButton(false);
  };

  const openSampleReport = () => {
    setShowSampleReport(true);
    requestAnimationFrame(() => {
      sampleSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  };

  const handleAnalyzeComplete = (reportData: Report, id: string | null) => {
    setReport(reportData);
    setReportId(id);
    setLoading(false);
    setError(null);
    setShowViewReportButton(true);
  };

  return (
    <main className="site-shell">
      <div className="site-grid" aria-hidden="true" />

      <header className="site-header page-container">
        <a href="#top" className="brand">
          <span className="brand-mark" aria-hidden="true">R</span>
          <span>
            <strong>RepoAtlas</strong>
            <small>Candidate Brief Generator</small>
          </span>
        </a>
        <div className="header-badges" aria-label="Product capabilities">
          <Badge>No AI required</Badge>
          <Badge>TS/JS + Python + Java</Badge>
          <Badge>{reportCapabilityCopy.headerBadge}</Badge>
        </div>
      </header>

      <section id="top" className="hero page-container">
        <div className="hero-copy">
          <p className="eyebrow">Evidence-backed repository analysis</p>
          <h1>Turn a codebase into an interview-ready Candidate Brief.</h1>
          <p className="hero-description">
            Upload a repository zip or paste a public GitHub URL — RepoAtlas maps the structure,
            risk areas, run commands, and evidence-backed talking points without executing code
            or calling AI.
          </p>
          <div className="hero-actions">
            <a className="btn btn-primary" href="#analyze">
              Analyze Repository <Arrow />
            </a>
            <button className="text-action" type="button" onClick={openSampleReport}>
              Try sample Candidate Brief <Arrow />
            </button>
          </div>
          <p className="hero-microcopy">
            ZIP upload or public GitHub URL. Local-first static analysis. No code execution. No AI calls.
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

      <section id="analyze" className="action-section page-container">
        <article className="analyze-card">
          <p className="section-kicker">Your first Candidate Brief</p>
          <h2>Start with the sample or a public GitHub repository.</h2>
          <p>Generate a complete bundled brief with one click, or paste a public GitHub URL to analyze your own codebase.</p>
          <InputForm
            onAnalyzeStart={() => {
              setLoading(true);
              setError(null);
            }}
            onAnalyzeComplete={handleAnalyzeComplete}
            onAnalyzeError={(message) => {
              setError(message);
              setLoading(false);
            }}
            loading={loading}
            sampleButtonRef={sampleButtonRef}
          />
          <div className="analyze-limits">
            <span>ZIP upload or public GitHub URL</span>
            <span>Reads repository files only</span>
            <span>Public repositories only</span>
            <span>{clientMaxZipMbLabel()}MB maximum zip</span>
            <span>Analysis up to 2 minutes</span>
          </div>
          {showViewReportButton && report && (
            <button type="button" onClick={scrollToReport} className="btn btn-secondary">
              View report <Arrow />
            </button>
          )}
          {error && <div role="alert" className="form-error">{error}</div>}
        </article>

        <aside className="sample-card">
          <div>
            <h2>Sample Candidate Brief</h2>
            <p>Inspect the output before uploading a repository.</p>
          </div>
          <ul>
            {["Reading path", "Risk areas", "Interview talking points", "Evidence refs"].map((item, index) => (
              <li key={item}><span>{String(index + 1).padStart(2, "0")}</span>{item}</li>
            ))}
          </ul>
          <button type="button" className="btn btn-inverse" onClick={openSampleReport}>
            Open sample report <Arrow />
          </button>
        </aside>
      </section>

      <section className="project-types page-container">
        <div className="section-heading">
          <h2>Try RepoAtlas on common project types</h2>
          <p>
            RepoAtlas adapts the same evidence-first workflow to different repository shapes.
            These cards describe analysis coverage; they are not live fixture buttons.
          </p>
        </div>
        <div className="project-grid">
          {projectTypes.map(([type, mark, detail], index) => (
            <article key={type} className={index === 0 || index === 3 ? "project-card featured" : "project-card"}>
              <span className="project-mark">{mark}</span>
              <div><h3>{type}</h3><p>{detail}</p></div>
              <span className="coverage-label">Analysis profile</span>
            </article>
          ))}
        </div>
      </section>

      <section className="interviewer-section">
        <div className="page-container interviewer-layout">
          <div className="interviewer-intro">
            <h2>Read your project like an interviewer would.</h2>
            <p>
              Move from orientation to defensible technical conversation without pretending the
              repository says more than it does.
            </p>
          </div>
          <div className="interviewer-list">
            {interviewerFeatures.map(([title, description], index) => (
              <article key={title}>
                <span>{String(index + 1).padStart(2, "0")}</span>
                <div><h3>{title}</h3><p>{description}</p></div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="pipeline-section page-container">
        <div className="section-heading compact">
          <h2>From archive to evidence-backed brief</h2>
          <p>A deterministic pipeline keeps each stage inspectable and the final claims grounded.</p>
        </div>
        <div className="pipeline" aria-label="RepoAtlas analysis pipeline">
          {["Zip upload", "Static analysis", "Language packs", "Scoring", "Candidate Brief", "Export / share"].map(
            (stage, index, stages) => (
              <div className="pipeline-stage" key={stage}>
                <span className="pipeline-node">{stage}</span>
                {index < stages.length - 1 && <span className="pipeline-arrow" aria-hidden="true">→</span>}
              </div>
            )
          )}
        </div>
        <div className="pipeline-notes">
          <span>files only</span>
          <span>TS/JS, Python, Java</span>
          <span>structural signals</span>
          <span>{reportCapabilityCopy.homepagePipelineSummary}</span>
        </div>
        <p className="pipeline-capability-note">{reportCapabilityCopy.homepageStorageNote}</p>
      </section>

      <section className="brief-section page-container">
        <div className="brief-intro">
          <h2>A brief built for the conversation after the code review.</h2>
          <p>RepoAtlas organizes what it can prove, what deserves attention, and where confidence is limited.</p>
        </div>
        <div className="brief-contents">
          {briefContents.map((item, index) => (
            <div key={item}><span>{String(index + 1).padStart(2, "0")}</span><strong>{item}</strong></div>
          ))}
        </div>
      </section>

      <section
        id="sample-report"
        ref={sampleSectionRef}
        className="sample-report-section page-container"
      >
        <div className="sample-report-heading">
          <div><h2>Sample Repo</h2></div>
          {!showSampleReport && (
            <button type="button" className="text-action" onClick={openSampleReport}>
              Open full sample report <Arrow />
            </button>
          )}
        </div>
        {!showSampleReport ? (
          <div className="sample-report-preview">
            <p className="sample-report-copy">
              Preview the bundled read-only Candidate Brief before uploading your own repository.
              Open the full report to explore tabs, exports, and evidence-linked sections.
            </p>
            <div className="brief-sheet" style={{ maxWidth: "36rem" }}>
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
            <button type="button" className="btn btn-primary" onClick={openSampleReport}>
              Open sample report <Arrow />
            </button>
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

      <section id="faq" className="faq-section">
        <div className="page-container faq-layout">
          <header className="faq-intro">
            <p className="section-kicker">Before you upload</p>
            <h2>Questions, answered plainly.</h2>
            <p>
              The short version on file handling, supported repositories, limits, and what
              RepoAtlas does with your code.
            </p>
            <a href="/privacy" className="faq-privacy-link">
              Read the privacy details <Arrow />
            </a>
          </header>
          <div className="faq-list">
            {homepageFaqItems.map(({ question, answer }, index) => (
              <article key={question}>
                <span aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
                <div>
                  <h3>{question}</h3>
                  <p>{answer}</p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="trust-section page-container">
        <div className="trust-title">
          <h2>What RepoAtlas will not claim.</h2>
          <p>Static signals are useful when their limits stay visible.</p>
        </div>
        <div className="guardrail-grid">
          {guardrails.map((item) => (
            <div key={item}><span aria-hidden="true">×</span><p>{item}</p></div>
          ))}
        </div>
      </section>

      {report && (
        <section ref={reportSectionRef} className="generated-report page-container">
          <div className="section-heading compact">
            <h2>
              {report.candidate_brief?.analysis_focus
                ? `Your ${report.candidate_brief.analysis_focus.label} Brief`
                : "Your Candidate Brief"}
            </h2>
            <p>
              {report.candidate_brief?.analysis_focus
                ? "The completed brief is adapted to your selected issue focus and tied to repository evidence."
                : reportId
                  ? "The generated report is ready to inspect, export, or share with a read-only link."
                  : "The generated report is ready to inspect and export as PDF or PNG."}
            </p>
          </div>
          <ReportTabs report={report} reportId={reportId} />
        </section>
      )}

      <section className="closing-section">
        <div className="page-container closing-content">
          <div>
            <h2>Export the brief. Share the report. Walk into the interview with receipts.</h2>
            <p>Start with the bundled sample or analyze a repository zip or public GitHub URL locally.</p>
          </div>
          <div className="closing-actions">
            <a className="btn btn-inverse" href="#sample-report" onClick={openSampleReport}>
              Try sample Candidate Brief <Arrow />
            </a>
            <a className="btn btn-light" href="#analyze">Analyze Repository <Arrow /></a>
          </div>
        </div>
      </section>

    </main>
  );
}
