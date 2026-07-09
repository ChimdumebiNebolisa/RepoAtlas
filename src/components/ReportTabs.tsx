"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { Report } from "@/types/report";
import { FolderMapTree } from "./FolderMapTree";
import { ElkArchitectureGraph } from "./ElkArchitectureGraph";
import { StartHereTable } from "./StartHereTable";
import { DangerZonesTable } from "./DangerZonesTable";
import { RunContributeSection } from "./RunContributeSection";
import { ReportDocument } from "./ReportDocument";
import { CandidateBriefPanel } from "./CandidateBriefPanel";
import { DeepAnalysisSection } from "./DeepAnalysisSection";
import { ERROR_CODES } from "@/lib/errors";
import { buildExportFilename } from "@/lib/exportNames";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";

const TABS = [
  "Candidate Brief",
  "Overview",
  "Folder Map",
  "Architecture Map",
  "Start Here",
  "Danger Zones",
  "Run & Contribute",
  "Export",
] as const;

const FALLBACK_ANALYSIS_MESSAGE = "Analysis failed. Check server logs.";

interface ReportTabsProps {
  report: Report;
  reportId?: string | null;
  variant?: "live" | "preview";
  initialDemoMode?: boolean;
}

interface ApiErrorLike {
  code?: string;
  message?: string;
}

type MarkdownSupportState = "unknown" | "available" | "unavailable";

export function formatApiError(payload: ApiErrorLike | null | undefined, fallback: string) {
  if (!payload) return fallback;
  if (payload.code && payload.message) return `${payload.code}: ${payload.message}`;
  return payload.message || payload.code || fallback;
}

export function describeMarkdownExportFailure(
  payload: ApiErrorLike | null | undefined,
  status: number,
  reportId: string
) {
  return `Markdown export failed (${reportId}, HTTP ${status}). ${formatApiError(
    payload,
    FALLBACK_ANALYSIS_MESSAGE
  )}`;
}

function getMarkdownRoute(reportId: string) {
  return `/api/reports/${reportId}/export/md`;
}

export function ReportTabs({
  report,
  reportId,
  variant = "live",
  initialDemoMode = false,
}: ReportTabsProps) {
  const tabsId = useId();
  const [activeTab, setActiveTab] = useState<(typeof TABS)[number]>("Candidate Brief");
  const [demoMode, setDemoMode] = useState(initialDemoMode);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [shareExpiresAt, setShareExpiresAt] = useState<string | null>(null);
  const [shareLoading, setShareLoading] = useState(false);
  const [shareError, setShareError] = useState<string | null>(null);
  const [exporting, setExporting] = useState<"pdf" | "png" | "md" | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const [markdownSupport, setMarkdownSupport] = useState<MarkdownSupportState>(
    reportId ? "unknown" : "unavailable"
  );
  const [markdownNote, setMarkdownNote] = useState<string | null>(
    reportId ? "Checking Markdown export availability..." : "Markdown export is available after analyzing a repository."
  );
  const exportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let alive = true;

    const preflightMarkdown = async () => {
      if (!reportId) {
        setMarkdownSupport("unavailable");
        setMarkdownNote("Markdown export is available after analyzing a repository.");
        return;
      }

      setMarkdownSupport("unknown");
      setMarkdownNote("Checking Markdown export availability...");

      try {
        const res = await fetch(getMarkdownRoute(reportId), { method: "HEAD" });

        if (!alive) return;

        if (res.ok || res.status === 405) {
          setMarkdownSupport("available");
          setMarkdownNote(null);
          return;
        }

        setMarkdownSupport("unavailable");
        setMarkdownNote(
          `Markdown export is currently unavailable (HTTP ${res.status}). You can still export PDF or PNG.`
        );
      } catch {
        if (!alive) return;
        setMarkdownSupport("unknown");
        setMarkdownNote("Could not verify Markdown export availability. You can still try exporting.");
      }
    };

    void preflightMarkdown();

    return () => {
      alive = false;
    };
  }, [reportId]);

  const renderExportCanvas = async () => {
    if (!exportRef.current) {
      throw new Error("Report snapshot is not ready yet.");
    }
    // Mermaid graphs render asynchronously; brief wait improves capture consistency.
    await new Promise((resolve) => setTimeout(resolve, 250));
    return html2canvas(exportRef.current, {
      backgroundColor: "#ffffff",
      scale: 2,
      useCORS: true,
      windowWidth: 1200,
    });
  };

  const downloadBlob = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  };

  const exportBasename = buildExportFilename({
    repoName: report.repo_metadata.name,
    analyzedAt: report.repo_metadata.analyzed_at,
    ext: "md",
  }).replace(/\.md$/, "");

  const handleExportPng = async () => {
    try {
      setExportError(null);
      setExporting("png");
      const canvas = await renderExportCanvas();
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, "image/png", 1)
      );
      if (!blob) throw new Error("Could not generate PNG image.");
      downloadBlob(blob, `${exportBasename}.png`);
    } catch (error) {
      setExportError(error instanceof Error ? error.message : "PNG export failed.");
    } finally {
      setExporting(null);
    }
  };

  const handleExportPdf = async () => {
    try {
      setExportError(null);
      setExporting("pdf");
      const canvas = await renderExportCanvas();
      const imageData = canvas.toDataURL("image/png");
      const pdf = new jsPDF({ orientation: "p", unit: "pt", format: "a4" });

      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 24;
      const renderWidth = pageWidth - margin * 2;
      const renderHeight = (canvas.height * renderWidth) / canvas.width;

      let heightLeft = renderHeight;
      let position = margin;
      pdf.addImage(imageData, "PNG", margin, position, renderWidth, renderHeight);
      heightLeft -= pageHeight - margin * 2;

      while (heightLeft > 0) {
        position = heightLeft - renderHeight + margin;
        pdf.addPage();
        pdf.addImage(imageData, "PNG", margin, position, renderWidth, renderHeight);
        heightLeft -= pageHeight - margin * 2;
      }

      pdf.save(`${exportBasename}.pdf`);
    } catch (error) {
      setExportError(error instanceof Error ? error.message : "PDF export failed.");
    } finally {
      setExporting(null);
    }
  };

  const handleExportMarkdown = async () => {
    if (!reportId) {
      setExportError("Markdown export is available after analyzing a repository.");
      return;
    }

    if (markdownSupport === "unavailable") {
      setExportError(markdownNote ?? "Markdown export is currently unavailable.");
      return;
    }

    try {
      setExportError(null);
      setExporting("md");

      const res = await fetch(getMarkdownRoute(reportId));
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        const message = describeMarkdownExportFailure(payload, res.status, reportId);
        console.error("Markdown export request failed", {
          reportId,
          status: res.status,
          code: payload.code ?? ERROR_CODES.ANALYSIS_FAILED,
          message: payload.message ?? FALLBACK_ANALYSIS_MESSAGE,
        });
        setExportError(message);
        return;
      }

      const markdown = await res.text();
      const blob = new Blob([markdown], { type: "text/markdown;charset=utf-8" });
      const disposition = res.headers.get("Content-Disposition");
      const filename =
        disposition?.match(/filename="([^"]+)"/)?.[1] ??
        buildExportFilename({
          repoName: report.repo_metadata.name,
          analyzedAt: report.repo_metadata.analyzed_at,
          ext: "md",
        });
      downloadBlob(blob, filename);
      setMarkdownSupport("available");
      setMarkdownNote(null);
    } catch (error) {
      setExportError(error instanceof Error ? error.message : "Markdown export failed.");
    } finally {
      setExporting(null);
    }
  };

  const handleCreateShareLink = async () => {
    if (!reportId || shareLoading) return;
    setShareLoading(true);
    setShareError(null);
    try {
      const res = await fetch(`/api/reports/${reportId}/share`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setShareError(data.message ?? "Failed to create share link.");
        return;
      }
      const path = data.sharePath as string;
      const url =
        typeof window !== "undefined" ? `${window.location.origin}${path}` : path;
      setShareUrl(url);
      setShareExpiresAt(data.expiresAt ?? null);
    } catch {
      setShareError("Failed to create share link.");
    } finally {
      setShareLoading(false);
    }
  };

  return (
    <div className="report-tabs mt-8">
      <div className="report-toolbar">
        <p id={`${tabsId}-export-summary`} className="report-toolbar-copy">
          {variant === "preview"
            ? "Read-only sample. PDF and PNG are available here; analyze a repository to export Markdown."
            : "Generated report ready for PDF, PNG, and Markdown export."}
        </p>
        <div className="report-toolbar-actions">
          <button
            type="button"
            onClick={handleExportPdf}
            disabled={exporting !== null}
            className="report-action report-action-primary report-action-compact"
          >
            {exporting === "pdf" ? "Exporting PDF..." : "Export PDF"}
          </button>
          <button
            type="button"
            onClick={handleExportPng}
            disabled={exporting !== null}
            className="report-action report-action-secondary report-action-compact"
          >
            {exporting === "png" ? "Exporting PNG..." : "Export PNG"}
          </button>
          <button
            type="button"
            onClick={handleExportMarkdown}
            disabled={exporting !== null || !reportId || markdownSupport === "unavailable"}
            className="report-action report-action-accent report-action-compact"
            title={markdownNote ?? undefined}
            aria-describedby={`${tabsId}-export-summary`}
          >
            {exporting === "md" ? "Exporting Markdown..." : "Export Markdown"}
          </button>
        </div>
      </div>

      <div className="report-tab-rail">
        <nav className="report-tab-list" aria-label="Report sections" role="tablist">
          {TABS.map((tab) => {
            const tabKey = tab.toLowerCase().replace(/[^a-z0-9]+/g, "-");
            return (
            <button
              key={tab}
              id={`${tabsId}-tab-${tabKey}`}
              type="button"
              role="tab"
              aria-selected={activeTab === tab}
              aria-controls={`${tabsId}-panel-${tabKey}`}
              onClick={() => setActiveTab(tab)}
              className="report-tab"
            >
              {tab}
            </button>
            );
          })}
        </nav>
      </div>

      <div
        id={`${tabsId}-panel-${activeTab.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`}
        role="tabpanel"
        aria-labelledby={`${tabsId}-tab-${activeTab.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`}
        className="py-4"
      >
        {activeTab === "Candidate Brief" && (
          <CandidateBriefPanel candidateBrief={report.candidate_brief} demoMode={demoMode} />
        )}

        {activeTab === "Overview" && (
          <div className="space-y-4">
            <h2 className="text-xl font-semibold">Repository</h2>
            <dl className="grid grid-cols-[auto_1fr] gap-2">
              <dt className="font-medium">Name:</dt>
              <dd>{report.repo_metadata.name}</dd>
              <dt className="font-medium">URL:</dt>
              <dd>
                <a
                  href={report.repo_metadata.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-emerald-700 hover:underline"
                >
                  {report.repo_metadata.url}
                </a>
              </dd>
              <dt className="font-medium">Branch:</dt>
              <dd>{report.repo_metadata.branch}</dd>
              <dt className="font-medium">Analyzed:</dt>
              <dd>{report.repo_metadata.analyzed_at}</dd>
              {report.partial && (
                <>
                  <dt className="font-medium">Status:</dt>
                  <dd className="text-amber-700">Partial report (analysis timed out)</dd>
                </>
              )}
            </dl>
            {reportId && variant === "live" && (
              <div className="mt-4 space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">
                <p className="font-medium text-slate-900">Share read-only Candidate Brief</p>
                <p className="text-xs text-slate-600">
                  Creates a token-gated link (7-day expiry). Shares report JSON only — never your
                  uploaded zip.
                </p>
                <button
                  type="button"
                  onClick={handleCreateShareLink}
                  disabled={shareLoading}
                  className="report-action report-action-secondary report-action-compact"
                >
                  {shareLoading ? "Creating link…" : "Create share link"}
                </button>
                {shareError && <p className="text-xs text-red-700">{shareError}</p>}
                {shareUrl && (
                  <p className="break-all text-xs text-slate-700">
                    <a href={shareUrl} className="font-medium text-emerald-700 hover:underline">
                      {shareUrl}
                    </a>
                    {shareExpiresAt && (
                      <span className="mt-1 block text-slate-500">
                        Expires {new Date(shareExpiresAt).toLocaleString()}
                      </span>
                    )}
                  </p>
                )}
              </div>
            )}
            <div className="mt-6">
              <h3 className="mb-3 text-lg font-semibold text-slate-900">Deep analysis</h3>
              <DeepAnalysisSection
                projectProfile={report.project_profile}
                testInventory={report.test_inventory}
                architectureInsights={report.architecture_insights}
                commitInsights={report.commit_insights}
              />
            </div>
            {report.run_commands.length > 0 && (
              <div>
                <h3 className="font-semibold mt-4">Run commands</h3>
                <ul className="list-disc list-inside">
                  {report.run_commands.map((cmd, i) => (
                    <li key={i}>
                      <code className="bg-gray-100 text-slate-900 px-1 rounded">
                        {cmd.command}
                      </code>
                      {cmd.description && ` - ${cmd.description}`}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {activeTab === "Folder Map" && <FolderMapTree node={report.folder_map} />}

        {activeTab === "Architecture Map" && (
          <ElkArchitectureGraph architecture={report.architecture} />
        )}

        {activeTab === "Start Here" && <StartHereTable items={report.start_here} />}

        {activeTab === "Danger Zones" && <DangerZonesTable items={report.danger_zones} />}

        {activeTab === "Run & Contribute" && (
          <RunContributeSection
            runCommands={report.run_commands}
            contributeSignals={report.contribute_signals}
          />
        )}

        {activeTab === "Export" && (
          <div className="space-y-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
            <h2 className="text-lg font-semibold text-slate-900">Export Report</h2>
            <p className="text-sm text-slate-700">
              Download this report as a full PDF document or a full-page PNG image.
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handleExportPdf}
                disabled={exporting !== null}
                className="report-action report-action-primary"
              >
                {exporting === "pdf" ? "Exporting PDF..." : "Export Full Report (PDF)"}
              </button>
              <button
                type="button"
                onClick={handleExportPng}
                disabled={exporting !== null}
                className="report-action report-action-secondary"
              >
                {exporting === "png" ? "Exporting PNG..." : "Export Full Report (PNG)"}
              </button>
            </div>
            <button
              type="button"
              onClick={handleExportMarkdown}
              disabled={exporting !== null || !reportId || markdownSupport === "unavailable"}
              className="report-action report-action-accent"
              title={markdownNote ?? undefined}
            >
              {exporting === "md" ? "Exporting Markdown..." : "Export Markdown"}
            </button>
            {markdownNote && <p className="text-xs text-slate-500">{markdownNote}</p>}
          </div>
        )}
      </div>

      {exportError && (
        <p className="mt-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {exportError}
        </p>
      )}

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={demoMode}
            onChange={(e) => setDemoMode(e.target.checked)}
            className="rounded border-slate-300 accent-emerald-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600"
          />
          Screenshot / demo mode
        </label>
      </div>

      <div className="pointer-events-none fixed -left-[10000px] top-0 w-[1100px] bg-white p-8 text-slate-900">
        <div ref={exportRef}>
          <h1 className="mb-2 text-3xl font-bold">Repo Analysis: {report.repo_metadata.name}</h1>
          <p className="mb-6 text-sm text-slate-600">{report.repo_metadata.url}</p>
          <ReportDocument report={report} />
        </div>
      </div>
    </div>
  );
}
