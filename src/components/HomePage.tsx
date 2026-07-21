"use client";

import { useEffect, useRef, useState } from "react";
import {
  HomepageHero,
  HomepageSampleProof,
  HomepageTrustAndFaq,
  HomepageWalkthroughOutcomes,
} from "@/components/HomepageProofSections";
import { InputForm, type InputFormHandle } from "@/components/InputForm";
import { ReportTabs } from "@/components/ReportTabs";
import { clientMaxZipMbLabel } from "@/lib/ingestLimitsClient";
import { reportCapabilityCopy } from "@/lib/reportCapabilities";
import type { Report } from "@/types/report";

function Badge({ children }: { children: React.ReactNode }) {
  return <span className="badge">{children}</span>;
}

export function HomePage({ sampleReport }: { sampleReport: Report }) {
  const [report, setReport] = useState<Report | null>(null);
  const [reportId, setReportId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSampleReport, setShowSampleReport] = useState(false);
  const reportSectionRef = useRef<HTMLElement | null>(null);
  const reportHeadingRef = useRef<HTMLHeadingElement | null>(null);
  const inputFormRef = useRef<InputFormHandle | null>(null);
  const sampleButtonRef = useRef<HTMLButtonElement | null>(null);
  const sampleSectionRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!report) return;

    const frame = requestAnimationFrame(() => {
      const documentElement = document.documentElement;
      const previousScrollBehavior = documentElement.style.scrollBehavior;

      documentElement.style.scrollBehavior = "auto";
      reportSectionRef.current?.scrollIntoView({ block: "start" });
      reportHeadingRef.current?.focus({ preventScroll: true });
      documentElement.style.scrollBehavior = previousScrollBehavior;
    });

    return () => cancelAnimationFrame(frame);
  }, [report]);

  const openSampleReport = () => {
    setShowSampleReport(true);
    requestAnimationFrame(() => {
      sampleSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  };

  const generateSampleBrief = () => {
    inputFormRef.current?.generateSample();
    requestAnimationFrame(() => {
      sampleButtonRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  };

  const handleAnalyzeComplete = (reportData: Report, id: string | null) => {
    setReport(reportData);
    setReportId(id);
    setLoading(false);
    setError(null);
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
          <Badge>TypeScript/JS + Python + Java</Badge>
          <Badge>{reportCapabilityCopy.headerBadge}</Badge>
        </div>
      </header>

      <HomepageHero onGenerateSample={generateSampleBrief} />

      <HomepageWalkthroughOutcomes />

      <section
        id="analyze"
        className={`action-section action-section-single page-container ${report ? "action-section-complete" : ""}`}
      >
        <article className="analyze-card">
          <p className="section-kicker">Your first Candidate Brief</p>
          <h2>Start with the sample or your repository.</h2>
          <p>
            Generate the bundled brief with one click. To analyze your own codebase, paste a
            public GitHub URL or upload a permitted ZIP.
          </p>
          <InputForm
            ref={inputFormRef}
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
          {error && <div role="alert" className="form-error">{error}</div>}
        </article>
      </section>

      {report && (
        <section
          ref={reportSectionRef}
          className="generated-report page-container"
          aria-labelledby="completed-report-heading"
          data-testid="generated-report"
        >
          <div className="section-heading compact">
            <h2
              ref={reportHeadingRef}
              id="completed-report-heading"
              tabIndex={-1}
              data-testid="completed-report-heading"
            >
              Your Candidate Brief is ready
            </h2>
            <p>
              {report.candidate_brief?.analysis_focus
                ? `Your ${report.candidate_brief.analysis_focus.label.toLowerCase()} brief is complete and tied to repository evidence.`
                : reportId
                  ? "Start with the summary and walkthrough, then inspect, export, or share the evidence-linked report."
                  : "Start with the summary and walkthrough, then inspect or export the evidence-linked report as PDF or PNG."}
            </p>
          </div>
          <ReportTabs report={report} reportId={reportId} />
        </section>
      )}

      <HomepageSampleProof
        sampleReport={sampleReport}
        showSampleReport={showSampleReport}
        onOpenSample={openSampleReport}
        sectionRef={sampleSectionRef}
      />

      <HomepageTrustAndFaq />
    </main>
  );
}
