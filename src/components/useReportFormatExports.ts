"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Report } from "@/types/report";
import { buildExportFilename } from "@/lib/exportNames";
import {
  captureProductEvent,
  captureReportExportFailure,
  type ReportVariant,
} from "@/lib/productAnalytics";
import {
  describeMarkdownExportFailure,
  INLINE_MARKDOWN_UNAVAILABLE,
  type ExportFormat,
  type MarkdownSupportState,
  type ReportFormatActionsState,
} from "./reportActionState";
import {
  canvasToBlobBeforeDeadline,
  createReportExportDeadline,
  PDF_EXPORT_TIMEOUT_MESSAGE,
  PNG_EXPORT_TIMEOUT_MESSAGE,
  renderPdfBeforeDeadline,
  settleBeforeReportExportDeadline,
} from "./reportExportRendering";
import { renderReportCanvasBeforeDeadline } from "./reportExportSnapshot";

export const MAX_PNG_CANVAS_DIMENSION = 32_000;
export function fitExportCanvasScale(
  width: number,
  height: number,
  requestedScale: number
): number {
  const longestSide = Math.max(1, width, height);
  return Math.min(requestedScale, MAX_PNG_CANVAS_DIMENSION / longestSide);
}
function getMarkdownRoute(reportId: string) {
  return `/api/reports/${reportId}/export/md`;
}
function waitForExportMount() {
  return new Promise<void>((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });
}
function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
async function waitForExportContent(exportNode: HTMLDivElement) {
  const deadline = Date.now() + 10_000;
  while (exportNode.querySelector('[data-architecture-state="loading"]')) {
    if (Date.now() > deadline) {
      throw new Error("The architecture map did not finish loading for export.");
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
}
export function useReportFormatExports({
  report,
  reportId,
  variant,
}: {
  report: Report;
  reportId?: string | null;
  variant: ReportVariant;
}): ReportFormatActionsState {
  const [exporting, setExporting] = useState<ExportFormat | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const [exportMountActive, setExportMountActive] = useState(false);
  const [markdownSupport, setMarkdownSupport] = useState<MarkdownSupportState>(
    reportId ? "unknown" : "unavailable"
  );
  const [markdownNote, setMarkdownNote] = useState<string | null>(
    reportId ? "Checking Markdown export availability..." : INLINE_MARKDOWN_UNAVAILABLE
  );
  const exportRef = useRef<HTMLDivElement>(null);
  const exportOperationRef = useRef<object | null>(null);
  const setExportNode = useCallback((node: HTMLDivElement | null) => {
    exportRef.current = node;
  }, []);
  const beginExportOperation = () => {
    const operation = {};
    exportOperationRef.current = operation;
    return operation;
  };
  const ownsExportOperation = (operation: object) => exportOperationRef.current === operation;
  const finishExportOperation = (operation: object) => {
    if (!ownsExportOperation(operation)) return;
    exportOperationRef.current = null;
    setExporting(null);
  };
  useEffect(() => () => {
    exportOperationRef.current = null;
  }, []);
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
        setMarkdownNote(
          "Could not verify Markdown export availability. You can still try exporting."
        );
      }
    };
    void preflightMarkdown();
    return () => {
      alive = false;
    };
  }, [reportId]);
  const renderExportCanvas = async (
    operation: object,
    deadline: number,
    timeoutMessage: string,
    scale = 1.5,
    constrainToBrowserLimit = false
  ) => {
    setExportMountActive(true);
    await waitForExportMount();
    const exportNode = exportRef.current;
    if (!exportNode) {
      setExportMountActive(false);
      throw new Error("Report snapshot is not ready yet.");
    }
    try {
      await waitForExportContent(exportNode);
      const { default: html2canvas } = await settleBeforeReportExportDeadline(
        import("html2canvas"),
        deadline,
        timeoutMessage
      );
      const resolvedScale = constrainToBrowserLimit
        ? fitExportCanvasScale(exportNode.scrollWidth, exportNode.scrollHeight, scale)
        : scale;
      return await renderReportCanvasBeforeDeadline({
        exportNode,
        html2canvas,
        scale: resolvedScale,
        deadline,
        timeoutMessage,
        shouldContinue: () => ownsExportOperation(operation),
      });
    } finally {
      setExportMountActive(false);
    }
  };
  const exportBasename = buildExportFilename({
    repoName: report.repo_metadata.name,
    analyzedAt: report.repo_metadata.analyzed_at,
    ext: "md",
  }).replace(/\.md$/, "");
  const handleExportPng = async () => {
    const operation = beginExportOperation();
    try {
      setExportError(null);
      setExporting("png");
      const deadline = createReportExportDeadline();
      const canvas = await renderExportCanvas(
        operation,
        deadline,
        PNG_EXPORT_TIMEOUT_MESSAGE,
        1.5,
        true
      );
      if (!ownsExportOperation(operation)) return;
      const blob = await canvasToBlobBeforeDeadline(
        canvas,
        deadline,
        PNG_EXPORT_TIMEOUT_MESSAGE
      );
      if (!ownsExportOperation(operation)) return;
      if (!blob) throw new Error("Could not generate PNG image.");
      downloadBlob(blob, `${exportBasename}.png`);
      captureProductEvent("report_exported", {
        format: "png",
        report_variant: variant,
      });
    } catch (error) {
      if (!ownsExportOperation(operation)) return;
      captureReportExportFailure("png", variant, "render_failed");
      setExportError(error instanceof Error ? error.message : "PNG export failed.");
    } finally {
      finishExportOperation(operation);
    }
  };
  const handleExportPdf = async () => {
    const operation = beginExportOperation();
    try {
      setExportError(null);
      setExporting("pdf");
      const deadline = createReportExportDeadline();
      const canvas = await renderExportCanvas(
        operation,
        deadline,
        PDF_EXPORT_TIMEOUT_MESSAGE,
        1,
        true
      );
      if (!ownsExportOperation(operation)) return;
      const pdf = await renderPdfBeforeDeadline(report, canvas, deadline);
      if (!ownsExportOperation(operation)) return;
      downloadBlob(pdf, `${exportBasename}.pdf`);
      captureProductEvent("report_exported", {
        format: "pdf",
        report_variant: variant,
      });
    } catch (error) {
      if (!ownsExportOperation(operation)) return;
      captureReportExportFailure("pdf", variant, "render_failed");
      setExportError(error instanceof Error ? error.message : "PDF export failed.");
    } finally {
      finishExportOperation(operation);
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
    const operation = beginExportOperation();
    try {
      setExportError(null);
      setExporting("md");
      const res = await fetch(getMarkdownRoute(reportId));
      if (!ownsExportOperation(operation)) return;
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        if (!ownsExportOperation(operation)) return;
        const message = describeMarkdownExportFailure(payload, res.status);
        captureReportExportFailure("markdown", variant, "http_error", res.status);
        console.error("Markdown export request failed", { status: res.status });
        setExportError(message);
        return;
      }
      const markdown = await res.text();
      if (!ownsExportOperation(operation)) return;
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
      captureProductEvent("report_exported", {
        format: "markdown",
        report_variant: variant,
      });
      setMarkdownSupport("available");
      setMarkdownNote(null);
    } catch (error) {
      if (!ownsExportOperation(operation)) return;
      captureReportExportFailure("markdown", variant, "request_failed");
      setExportError(error instanceof Error ? error.message : "Markdown export failed.");
    } finally {
      finishExportOperation(operation);
    }
  };
  return {
    exporting,
    exportError,
    exportMountActive,
    setExportNode,
    markdownSupport,
    markdownNote,
    handleExportPng,
    handleExportPdf,
    handleExportMarkdown,
  };
}
