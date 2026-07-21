"use client";

import type { Report } from "@/types/report";
import type { ReportVariant } from "@/lib/productAnalytics";
import { repoSourceLabel } from "@/lib/format";
import { reportCapabilityCopy } from "@/lib/reportCapabilities";
import { ReportDocument } from "./ReportDocument";
import type { ReportActionsState } from "./useReportActions";

export function ReportToolbar({
  actions,
  reportId,
  tabsId,
  variant,
}: {
  actions: ReportActionsState;
  reportId?: string | null;
  tabsId: string;
  variant: ReportVariant;
}) {
  const summary =
    variant === "preview"
      ? reportCapabilityCopy.previewReport
      : variant === "shared"
        ? "Shared read-only Candidate Brief. PDF and PNG export are available; Markdown requires the original analysis session."
        : !reportId
          ? reportCapabilityCopy.inlineReport
          : actions.markdownSupport === "available"
            ? "Generated report ready for PDF, PNG, and Markdown export."
            : actions.markdownNote?.startsWith("Checking")
              ? "Generated report ready for PDF and PNG export. Checking Markdown export availability."
              : `Generated report ready for PDF and PNG export. ${actions.markdownNote ?? "Markdown export availability could not be verified."}`;

  return (
    <div className="report-toolbar">
      <p id={`${tabsId}-export-summary`} className="report-toolbar-copy">
        {summary}
      </p>
      <div className="report-toolbar-actions">
        <button
          type="button"
          onClick={actions.handleExportPdf}
          disabled={actions.exporting !== null}
          className="report-action report-action-primary report-action-compact"
        >
          {actions.exporting === "pdf" ? "Exporting PDF..." : "Export PDF"}
        </button>
        <button
          type="button"
          onClick={actions.handleExportPng}
          disabled={actions.exporting !== null}
          className="report-action report-action-secondary report-action-compact"
        >
          {actions.exporting === "png" ? "Exporting PNG..." : "Export PNG"}
        </button>
        <button
          type="button"
          onClick={actions.handleExportMarkdown}
          disabled={
            actions.exporting !== null || !reportId || actions.markdownSupport === "unavailable"
          }
          className="report-action report-action-accent report-action-compact"
          title={actions.markdownNote ?? undefined}
          aria-describedby={`${tabsId}-export-summary`}
        >
          {actions.exporting === "md" ? "Exporting Markdown..." : "Export Markdown"}
        </button>
      </div>
    </div>
  );
}

export function CandidateBriefSharePrompt({
  actions,
  tabsId,
}: {
  actions: ReportActionsState;
  tabsId: string;
}) {
  return (
    <aside className="report-share-prompt" aria-labelledby={`${tabsId}-share-heading`}>
      <div>
        <p className="report-share-eyebrow">Ready for a second set of eyes?</p>
        <h2 id={`${tabsId}-share-heading`}>Share this Candidate Brief privately.</h2>
        <p>
          Copy or send a read-only link after you have checked the brief. It expires in 7 days and
          never includes the uploaded zip.
        </p>
      </div>
      <div className="report-share-action">
        <button
          type="button"
          onClick={actions.handleShareCandidateBrief}
          disabled={actions.shareLoading}
          className="report-action report-action-primary"
        >
          {actions.shareLoading ? "Preparing private link…" : "Share Candidate Brief"}
        </button>
        {actions.shareMessage && (
          <p role="status" className="report-share-success">
            {actions.shareMessage}{" "}
            {actions.shareUrl && (
              <a href={actions.shareUrl} target="_blank" rel="noopener noreferrer">
                Open shared copy
              </a>
            )}
          </p>
        )}
        {actions.shareError && (
          <div className="report-share-recovery">
            <p id={`${tabsId}-share-error`} role="alert" className="report-share-error">
              {actions.shareError}
            </p>
            <button
              type="button"
              onClick={actions.handleExportPdf}
              disabled={actions.exporting !== null}
              aria-describedby={`${tabsId}-share-error`}
              className="report-action report-action-secondary"
            >
              {actions.exporting === "pdf" ? "Exporting PDF..." : "Export PDF instead"}
            </button>
          </div>
        )}
        {actions.shareExpiresAt && (
          <p className="report-share-expiry">
            Expires {new Date(actions.shareExpiresAt).toLocaleString()}
          </p>
        )}
      </div>
    </aside>
  );
}

export function ReportExportPanel({
  actions,
  reportId,
}: {
  actions: ReportActionsState;
  reportId?: string | null;
}) {
  return (
    <div className="space-y-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
      <h2 className="text-lg font-semibold text-slate-900">Export Report</h2>
      <p className="text-sm text-slate-700">
        Download this report as a full PDF document or a full-page PNG image.
      </p>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={actions.handleExportPdf}
          disabled={actions.exporting !== null}
          className="report-action report-action-primary"
        >
          {actions.exporting === "pdf" ? "Exporting PDF..." : "Export Full Report (PDF)"}
        </button>
        <button
          type="button"
          onClick={actions.handleExportPng}
          disabled={actions.exporting !== null}
          className="report-action report-action-secondary"
        >
          {actions.exporting === "png" ? "Exporting PNG..." : "Export Full Report (PNG)"}
        </button>
      </div>
      <button
        type="button"
        onClick={actions.handleExportMarkdown}
        disabled={
          actions.exporting !== null || !reportId || actions.markdownSupport === "unavailable"
        }
        className="report-action report-action-accent"
        title={actions.markdownNote ?? undefined}
      >
        {actions.exporting === "md" ? "Exporting Markdown..." : "Export Markdown"}
      </button>
      {actions.markdownNote && <p className="text-xs text-slate-500">{actions.markdownNote}</p>}
    </div>
  );
}

export function ReportActionFeedback({ actions }: { actions: ReportActionsState }) {
  return actions.exportError ? (
    <p className="mt-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
      {actions.exportError}
    </p>
  ) : null;
}

export function HiddenReportExport({
  exportMountActive,
  report,
  registerExportNode,
}: {
  exportMountActive: boolean;
  report: Report;
  registerExportNode: (node: HTMLDivElement | null) => void;
}) {
  if (!exportMountActive) return null;
  return (
    <div className="pointer-events-none fixed -left-[10000px] top-0 w-[1100px] bg-white p-8 text-slate-900">
      <div ref={registerExportNode}>
        <h1 className="mb-2 text-3xl font-bold">Repo Analysis: {report.repo_metadata.name}</h1>
        <p className="mb-6 text-sm text-slate-600">{repoSourceLabel(report.repo_metadata.url)}</p>
        <ReportDocument report={report} />
      </div>
    </div>
  );
}
