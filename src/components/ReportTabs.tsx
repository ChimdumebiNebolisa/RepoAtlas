"use client";

import { useEffect, useId, useRef, useState } from "react";
import dynamic from "next/dynamic";
import type { Report } from "@/types/report";
import { captureReportViewed, type ReportVariant } from "@/lib/productAnalytics";
import { CandidateBriefPanel } from "./CandidateBriefPanel";
import { DangerZonesTable } from "./DangerZonesTable";
import { FolderMapTree } from "./FolderMapTree";
import {
  CandidateBriefSharePrompt,
  HiddenReportExport,
  ReportActionFeedback,
  ReportExportPanel,
  ReportToolbar,
} from "./ReportActionViews";
import { ReportNavigation, reportTabKey, type ReportTab } from "./ReportNavigation";
import { ReportOverview } from "./ReportOverview";
import { RunContributeSection } from "./RunContributeSection";
import { StartHereTable } from "./StartHereTable";
import { useReportActions } from "./useReportActions";

export {
  MAX_PNG_CANVAS_DIMENSION,
  describeMarkdownExportFailure,
  fitExportCanvasScale,
  formatApiError,
} from "./useReportActions";

const ElkArchitectureGraph = dynamic(
  () => import("./ElkArchitectureGraph").then((module) => module.ElkArchitectureGraph),
  {
    ssr: false,
    loading: () => (
      <p data-architecture-state="loading" className="text-gray-500">
        Loading architecture map...
      </p>
    ),
  }
);

interface ReportTabsProps {
  report: Report;
  reportId?: string | null;
  variant?: ReportVariant;
  initialDemoMode?: boolean;
}

export function ReportTabs({
  report,
  reportId,
  variant = "live",
  initialDemoMode = false,
}: ReportTabsProps) {
  const workspaceKey = [
    reportId ?? "inline",
    variant,
    report.repo_metadata.name,
    report.repo_metadata.url,
    report.repo_metadata.branch,
    report.repo_metadata.clone_hash ?? "working-tree",
    report.repo_metadata.analyzed_at,
    report.analysis_intent ?? "interview",
  ].join("\u0000");

  return (
    <ReportWorkspace
      key={workspaceKey}
      report={report}
      reportId={reportId}
      variant={variant}
      initialDemoMode={initialDemoMode}
    />
  );
}

function ReportWorkspace({
  report,
  reportId,
  variant = "live",
  initialDemoMode = false,
}: ReportTabsProps) {
  const tabsId = useId();
  const [activeTab, setActiveTab] = useState<ReportTab>("Candidate Brief");
  const [demoMode, setDemoMode] = useState(
    process.env.NODE_ENV === "development" && initialDemoMode
  );
  const candidateBriefRef = useRef<HTMLDivElement>(null);
  const viewedReportRef = useRef<Report | null>(null);
  const actions = useReportActions({ report, reportId, variant });

  useEffect(() => {
    if (
      activeTab !== "Candidate Brief" ||
      !report.candidate_brief ||
      viewedReportRef.current === report ||
      typeof IntersectionObserver === "undefined"
    ) {
      return;
    }

    const candidateBrief = candidateBriefRef.current;
    if (!candidateBrief) return;

    const observer = new IntersectionObserver((entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return;
      viewedReportRef.current = report;
      captureReportViewed(variant);
      observer.disconnect();
    });

    observer.observe(candidateBrief);
    return () => observer.disconnect();
  }, [activeTab, report, variant]);

  const activeTabKey = reportTabKey(activeTab);

  return (
    <div className="report-tabs mt-8">
      <ReportToolbar actions={actions} reportId={reportId} tabsId={tabsId} variant={variant} />
      <ReportNavigation activeTab={activeTab} onChange={setActiveTab} tabsId={tabsId} />

      <div
        id={`${tabsId}-panel-${activeTabKey}`}
        role="tabpanel"
        aria-labelledby={`${tabsId}-tab-${activeTabKey}`}
        tabIndex={0}
        className="py-4"
      >
        {activeTab === "Candidate Brief" && (
          <div ref={candidateBriefRef} className="space-y-6">
            <CandidateBriefPanel
              candidateBrief={report.candidate_brief}
              demoMode={demoMode}
              reportVariant={variant}
            />
            {variant === "live" && report.candidate_brief && (
              <CandidateBriefSharePrompt actions={actions} tabsId={tabsId} />
            )}
          </div>
        )}

        {activeTab === "Overview" && <ReportOverview report={report} />}
        {activeTab === "Folder Map" && <FolderMapTree node={report.folder_map} />}
        {activeTab === "Architecture Map" && (
          <ElkArchitectureGraph
            architecture={report.architecture}
            semanticGraph={report.semantic_graph}
          />
        )}
        {activeTab === "Start Here" && <StartHereTable items={report.start_here} />}
        {activeTab === "Danger Zones" && <DangerZonesTable items={report.danger_zones} />}
        {activeTab === "Run & Contribute" && (
          <RunContributeSection
            runCommands={report.run_commands}
            contributeSignals={report.contribute_signals}
          />
        )}
        {activeTab === "Export" && <ReportExportPanel actions={actions} reportId={reportId} />}
      </div>

      <ReportActionFeedback actions={actions} />

      {process.env.NODE_ENV === "development" && (
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={demoMode}
              onChange={(event) => setDemoMode(event.target.checked)}
              className="rounded border-slate-300 accent-emerald-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600"
            />
            Screenshot / demo mode
          </label>
        </div>
      )}

      <HiddenReportExport
        exportMountActive={actions.exportMountActive}
        registerExportNode={actions.setExportNode}
        report={report}
      />
    </div>
  );
}
