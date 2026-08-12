"use client";

import { useEffect, useRef, useState } from "react";
import {
  HomepageHero,
  HomepageSampleProof,
  HomepageSupportedWorkflows,
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
  const directSampleStartedRef = useRef(false);

  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    if (
      directSampleStartedRef.current ||
      searchParams.get("sample") !== "1"
    ) {
      return;
    }

    directSampleStartedRef.current = true;
    inputFormRef.current?.generateSample();

    searchParams.delete("sample");
    const nextSearch = searchParams.toString();
    window.history.replaceState(
      window.history.state,
      "",
      `${window.location.pathname}${nextSearch ? `?${nextSearch}` : ""}${window.location.hash}`,
    );
  }, []);

  useEffect(() => {
    if (!report) return;

    let positionFrame: number | null = null;
    const frame = requestAnimationFrame(() => {
      reportSectionRef.current?.scrollIntoView({ behavior: "instant", block: "start" });
      positionFrame = requestAnimationFrame(() => {
        // Repeat after one paint so scroll anchoring from the replaced report
        // cannot move the completed heading back above the viewport.
        reportSectionRef.current?.scrollIntoView({ behavior: "instant", block: "start" });
        reportHeadingRef.current?.focus({ preventScroll: true });
      });
    });

    return () => {
      cancelAnimationFrame(frame);
      if (positionFrame !== null) cancelAnimationFrame(positionFrame);
    };
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
      sampleButtonRef.current?.scrollIntoView({ block: "center" });
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
            <small>Source-linked Repository Briefs</small>
          </span>
        </a>
        <div className="header-badges" aria-label="Product capabilities">
          <Badge>Reads files, never runs code</Badge>
          <Badge>TypeScript/JS + Python + Java</Badge>
          <Badge>{reportCapabilityCopy.headerBadge}</Badge>
        </div>
      </header>

      <HomepageHero onGenerateSample={generateSampleBrief} sampleReport={sampleReport} />

      <HomepageWalkthroughOutcomes />

      <HomepageSupportedWorkflows />

      <HomepageSampleProof
        sampleReport={sampleReport}
        showSampleReport={showSampleReport}
        onOpenSample={openSampleReport}
        sectionRef={sampleSectionRef}
      />

      <section
        id="analyze"
        className={`action-section action-section-single page-container ${report ? "action-section-complete" : ""}`}
      >
        <article className="analyze-card">
          <h2>Analyze your repository.</h2>
          <p>
            Paste a public GitHub URL or upload a ZIP, then choose what you need to understand.
          </p>
          <InputForm
            ref={inputFormRef}
            onAnalyzeStart={() => {
              setReport(null);
              setReportId(null);
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
            <span>Public GitHub URL or ZIP upload</span>
            <span>Files are read, never run</span>
            <span>Public GitHub repositories only</span>
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
              Your repository brief is ready
            </h2>
            <p>
              {report.candidate_brief?.analysis_focus
                ? `Your ${report.candidate_brief.analysis_focus.label.toLowerCase()} repository brief is ready. Review the linked files and confidence notes.`
                : reportId
                  ? "Start with the purpose and reading path, then inspect, export, or share the source-linked report."
                  : "Start with the purpose and reading path, then inspect or export the source-linked report as PDF or PNG."}
            </p>
          </div>
          <ReportTabs report={report} reportId={reportId} />
        </section>
      )}

      <HomepageTrustAndFaq />
    </main>
  );
}
