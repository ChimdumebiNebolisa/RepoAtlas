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
import { DocumentsPanel } from "./DocumentsPanel";
import { ERROR_CODES } from "@/lib/errors";
import { buildExportFilename } from "@/lib/exportNames";
import { isHttpUrl, repoSourceLabel, formatTimestamp } from "@/lib/format";
import {
  captureProductEvent,
  captureReportShared,
  type ReportShareMethod,
  type ReportShareType,
} from "@/lib/productAnalytics";
import { createPortableShareLink } from "@/lib/portableSharing";

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
  variant?: "live" | "preview" | "shared";
  initialDemoMode?: boolean;
}

interface ApiErrorLike {
  code?: string;
  message?: string;
}

type MarkdownSupportState = "unknown" | "available" | "unavailable";

const INLINE_MARKDOWN_UNAVAILABLE =
  "Markdown export needs saved report storage, which is currently unavailable. You can still export PDF or PNG.";

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
  const [demoMode, setDemoMode] = useState(
    process.env.NODE_ENV === "development" && initialDemoMode
  );
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [shareExpiresAt, setShareExpiresAt] = useState<string | null>(null);
  const [shareLoading, setShareLoading] = useState(false);
  const [shareError, setShareError] = useState<string | null>(null);
  const [shareMessage, setShareMessage] = useState<string | null>(null);
  const [shareCounted, setShareCounted] = useState(false);
  const [exporting, setExporting] = useState<"pdf" | "png" | "md" | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const [exportMountActive, setExportMountActive] = useState(false);
  const [markdownSupport, setMarkdownSupport] = useState<MarkdownSupportState>(
    reportId ? "unknown" : "unavailable"
  );
  const [markdownNote, setMarkdownNote] = useState<string | null>(
    reportId ? "Checking Markdown export availability..." : INLINE_MARKDOWN_UNAVAILABLE
  );
  const exportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let alive = true;

    const preflightMarkdown = async () => {
      if (!reportId) {
        setMarkdownSupport("unavailable");
        setMarkdownNote(INLINE_MARKDOWN_UNAVAILABLE);
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

  const waitForExportMount = () =>
    new Promise<void>((resolve) => {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => resolve());
      });
    });

  const renderExportCanvas = async () => {
    setExportMountActive(true);
    await waitForExportMount();
    if (!exportRef.current) {
      setExportMountActive(false);
      throw new Error("Report snapshot is not ready yet.");
    }
    // Mermaid graphs render asynchronously; brief wait improves capture consistency.
    await new Promise((resolve) => setTimeout(resolve, 250));
    const { default: html2canvas } = await import("html2canvas");
    try {
      return await html2canvas(exportRef.current, {
        backgroundColor: "#ffffff",
        scale: 2,
        useCORS: true,
        windowWidth: 1200,
      });
    } finally {
      setExportMountActive(false);
    }
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
      captureProductEvent("report_exported", { format: "png", report_variant: variant });
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
      const { default: jsPDF } = await import("jspdf");
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
      captureProductEvent("report_exported", { format: "pdf", report_variant: variant });
    } catch (error) {
      setExportError(error instanceof Error ? error.message : "PDF export failed.");
    } finally {
      setExporting(null);
    }
  };

  const handleExportMarkdown = async () => {
    if (!reportId) {
      setExportError(INLINE_MARKDOWN_UNAVAILABLE);
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
      captureProductEvent("report_exported", { format: "markdown", report_variant: variant });
      setMarkdownSupport("available");
      setMarkdownNote(null);
    } catch (error) {
      setExportError(error instanceof Error ? error.message : "Markdown export failed.");
    } finally {
      setExporting(null);
    }
  };

  const copyShareLink = async (url: string): Promise<boolean> => {
    try {
      await navigator.clipboard.writeText(url);
      return true;
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = url;
      textarea.setAttribute("readonly", "");
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      const copied = document.execCommand("copy");
      document.body.removeChild(textarea);
      return copied;
    }
  };

  const deliverShareLink = async (
    url: string
  ): Promise<ReportShareMethod | "cancelled" | null> => {
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({
          title: "RepoAtlas Candidate Brief",
          text: "A read-only Candidate Brief from RepoAtlas.",
          url,
        });
        return "native";
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return "cancelled";
        return null;
      }
    }
    return (await copyShareLink(url)) ? "clipboard" : null;
  };

  const handleShareCandidateBrief = async () => {
    if (shareLoading || variant !== "live") return;
    setShareLoading(true);
    setShareError(null);
    setShareMessage(null);
    try {
      let url: string;
      let expiresAt: string;
      let shareType: ReportShareType;

      if (reportId) {
        const res = await fetch(`/api/reports/${reportId}/share`, { method: "POST" });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.message ?? "Failed to create a private link.");
        const path = data.sharePath as string;
        url = `${window.location.origin}${path}`;
        expiresAt = data.expiresAt as string;
        shareType = "stored_link";
      } else {
        const portable = await createPortableShareLink(report, window.location.origin);
        url = portable.url;
        expiresAt = portable.expiresAt;
        shareType = "portable_link";
      }

      const method = await deliverShareLink(url);
      if (method === "cancelled") return;
      if (!method) {
        throw new Error("Could not share or copy the private link. Export PDF to share it instead.");
      }

      setShareUrl(url);
      setShareExpiresAt(expiresAt);
      setShareMessage(
        method === "native"
          ? "Shared successfully. The private link expires in 7 days."
          : "Private link copied. It expires in 7 days."
      );
      if (!shareCounted) {
        captureReportShared(method, shareType);
        setShareCounted(true);
      }
    } catch (error) {
      setShareError(
        error instanceof Error
          ? error.message
          : "Could not create a private link. Export PDF to share this brief."
      );
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
            : variant === "shared"
              ? "Shared read-only Candidate Brief. PDF and PNG export are available; Markdown requires the original analysis session."
              : !reportId
                ? "Generated report ready for PDF and PNG export. Markdown needs saved report storage, which is currently unavailable."
                : markdownSupport === "available"
                  ? "Generated report ready for PDF, PNG, and Markdown export."
                  : markdownNote?.startsWith("Checking")
                    ? "Generated report ready for PDF and PNG export. Checking Markdown export availability."
                    : `Generated report ready for PDF and PNG export. ${markdownNote ?? "Markdown export availability could not be verified."}`}
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
          <div className="space-y-6">
            <CandidateBriefPanel candidateBrief={report.candidate_brief} demoMode={demoMode} />
            {variant === "live" && report.candidate_brief && (
              <aside className="report-share-prompt" aria-labelledby={`${tabsId}-share-heading`}>
                <div>
                  <p className="report-share-eyebrow">Ready for a second set of eyes?</p>
                  <h2 id={`${tabsId}-share-heading`}>Share this Candidate Brief privately.</h2>
                  <p>
                    Copy or send a read-only link after you have checked the brief. It expires
                    in 7 days and never includes the uploaded zip.
                  </p>
                </div>
                <div className="report-share-action">
                  <button
                    type="button"
                    onClick={handleShareCandidateBrief}
                    disabled={shareLoading}
                    className="report-action report-action-primary"
                  >
                    {shareLoading ? "Preparing private link…" : "Share Candidate Brief"}
                  </button>
                  {shareMessage && (
                    <p role="status" className="report-share-success">
                      {shareMessage}{" "}
                      {shareUrl && (
                        <a href={shareUrl} target="_blank" rel="noopener noreferrer">
                          Open shared copy
                        </a>
                      )}
                    </p>
                  )}
                  {shareError && <p role="alert" className="report-share-error">{shareError}</p>}
                  {shareExpiresAt && (
                    <p className="report-share-expiry">
                      Expires {new Date(shareExpiresAt).toLocaleString()}
                    </p>
                  )}
                </div>
              </aside>
            )}
          </div>
        )}

        {activeTab === "Overview" && (
          <div className="space-y-4">
            <h2 className="text-xl font-semibold">Repository</h2>
            <dl className="grid grid-cols-[auto_1fr] gap-2">
              <dt className="font-medium">Name:</dt>
              <dd>{report.repo_metadata.name}</dd>
              <dt className="font-medium">Source:</dt>
              <dd>
                {isHttpUrl(report.repo_metadata.url) ? (
                  <a
                    href={report.repo_metadata.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-emerald-700 hover:underline"
                  >
                    {report.repo_metadata.url}
                  </a>
                ) : (
                  <span>{repoSourceLabel(report.repo_metadata.url)}</span>
                )}
              </dd>
              <dt className="font-medium">Branch:</dt>
              <dd>{report.repo_metadata.branch}</dd>
              <dt className="font-medium">Analyzed:</dt>
              <dd>
                {(() => {
                  const t = formatTimestamp(report.repo_metadata.analyzed_at);
                  return t.dateTime ? (
                    <time dateTime={t.dateTime}>{t.display}</time>
                  ) : (
                    <span>{t.display}</span>
                  );
                })()}
              </dd>
              {report.partial && (
                <>
                  <dt className="font-medium">Status:</dt>
                  <dd className="text-amber-700">Partial report (analysis timed out)</dd>
                </>
              )}
            </dl>
            {report.document_inventory && (
              <div className="mt-6">
                <h3 className="mb-3 text-lg font-semibold text-slate-900">Documentation inventory</h3>
                <DocumentsPanel inventory={report.document_inventory} />
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

      {process.env.NODE_ENV === "development" && (
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
      )}

      {exportMountActive && (
        <div className="pointer-events-none fixed -left-[10000px] top-0 w-[1100px] bg-white p-8 text-slate-900">
          <div ref={exportRef}>
            <h1 className="mb-2 text-3xl font-bold">Repo Analysis: {report.repo_metadata.name}</h1>
            <p className="mb-6 text-sm text-slate-600">{repoSourceLabel(report.repo_metadata.url)}</p>
            <ReportDocument report={report} />
          </div>
        </div>
      )}
    </div>
  );
}
