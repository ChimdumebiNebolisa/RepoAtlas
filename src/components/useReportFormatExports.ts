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
    requestAnimationFrame(() => {
      requestAnimationFrame(() => resolve());
    });
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
async function renderPdf(report: Report, canvas: HTMLCanvasElement) {
  const { default: jsPDF } = await import("jspdf");
  const pdf = new jsPDF({ orientation: "p", unit: "pt", format: "a4" });
  pdf.setProperties({
    title: `Repo Analysis: ${report.repo_metadata.name}`,
    subject: "RepoAtlas Candidate Brief",
    creator: "RepoAtlas",
  });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 24;
  const renderWidth = pageWidth - margin * 2;
  const renderHeight = pageHeight - margin * 2;
  const sourcePageHeight = Math.max(
    1,
    Math.floor((renderHeight * canvas.width) / renderWidth)
  );
  for (let sourceY = 0, pageIndex = 0; sourceY < canvas.height; pageIndex += 1) {
    const sliceHeight = Math.min(sourcePageHeight, canvas.height - sourceY);
    const slice = document.createElement("canvas");
    slice.width = canvas.width;
    slice.height = sliceHeight;
    const context = slice.getContext("2d");
    if (!context) throw new Error("Could not prepare a PDF page.");
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, slice.width, slice.height);
    context.drawImage(
      canvas,
      0,
      sourceY,
      canvas.width,
      sliceHeight,
      0,
      0,
      canvas.width,
      sliceHeight
    );
    const blob = await new Promise<Blob | null>((resolve) =>
      slice.toBlob(resolve, "image/png", 1)
    );
    if (!blob) throw new Error("Could not generate a PDF page image.");
    const imageBytes = new Uint8Array(await blob.arrayBuffer());
    const pageRenderHeight = (sliceHeight * renderWidth) / canvas.width;
    if (pageIndex > 0) pdf.addPage();
    pdf.addImage(
      imageBytes,
      "PNG",
      margin,
      margin,
      renderWidth,
      pageRenderHeight,
      undefined,
      "FAST"
    );
    slice.width = 1;
    slice.height = 1;
    sourceY += sliceHeight;
  }
  return pdf.output("blob");
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
  const setExportNode = useCallback((node: HTMLDivElement | null) => {
    exportRef.current = node;
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
  const renderExportCanvas = async (scale = 1.5, constrainForPng = false) => {
    setExportMountActive(true);
    await waitForExportMount();
    const exportNode = exportRef.current;
    if (!exportNode) {
      setExportMountActive(false);
      throw new Error("Report snapshot is not ready yet.");
    }
    try {
      await waitForExportContent(exportNode);
      const { default: html2canvas } = await import("html2canvas");
      const resolvedScale = constrainForPng
        ? fitExportCanvasScale(exportNode.scrollWidth, exportNode.scrollHeight, scale)
        : scale;
      return await html2canvas(exportNode, {
        backgroundColor: "#ffffff",
        scale: resolvedScale,
        useCORS: true,
        windowWidth: 1200,
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
    try {
      setExportError(null);
      setExporting("png");
      const canvas = await renderExportCanvas(1.5, true);
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, "image/png", 1)
      );
      if (!blob) throw new Error("Could not generate PNG image.");
      downloadBlob(blob, `${exportBasename}.png`);
      captureProductEvent("report_exported", {
        format: "png",
        report_variant: variant,
      });
    } catch (error) {
      captureReportExportFailure("png", variant, "render_failed");
      setExportError(error instanceof Error ? error.message : "PNG export failed.");
    } finally {
      setExporting(null);
    }
  };
  const handleExportPdf = async () => {
    try {
      setExportError(null);
      setExporting("pdf");
      const canvas = await renderExportCanvas(1);
      downloadBlob(await renderPdf(report, canvas), `${exportBasename}.pdf`);
      captureProductEvent("report_exported", {
        format: "pdf",
        report_variant: variant,
      });
    } catch (error) {
      captureReportExportFailure("pdf", variant, "render_failed");
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
        const message = describeMarkdownExportFailure(payload, res.status);
        captureReportExportFailure("markdown", variant, "http_error", res.status);
        console.error("Markdown export request failed", { status: res.status });
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
      captureProductEvent("report_exported", {
        format: "markdown",
        report_variant: variant,
      });
      setMarkdownSupport("available");
      setMarkdownNote(null);
    } catch (error) {
      captureReportExportFailure("markdown", variant, "request_failed");
      setExportError(error instanceof Error ? error.message : "Markdown export failed.");
    } finally {
      setExporting(null);
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
