"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Report } from "@/types/report";
import { buildExportFilename } from "@/lib/exportNames";
import {
  captureProductEvent,
  captureReportExportFailure,
  captureReportShared,
  type ReportShareMethod,
  type ReportShareType,
  type ReportVariant,
} from "@/lib/productAnalytics";
import { createPortableShareLink } from "@/lib/portableSharing";

const FALLBACK_ANALYSIS_MESSAGE = "Analysis failed. Check server logs.";

export const MAX_PNG_CANVAS_DIMENSION = 32_000;

export function fitExportCanvasScale(
  width: number,
  height: number,
  requestedScale: number
): number {
  const longestSide = Math.max(1, width, height);
  return Math.min(requestedScale, MAX_PNG_CANVAS_DIMENSION / longestSide);
}

interface ApiErrorLike {
  code?: string;
  message?: string;
}

export type MarkdownSupportState = "unknown" | "available" | "unavailable";
export type ExportFormat = "pdf" | "png" | "md";

export const INLINE_MARKDOWN_UNAVAILABLE =
  "Markdown export needs saved report storage, which is currently unavailable. You can still export PDF or PNG.";

export function formatApiError(payload: ApiErrorLike | null | undefined, fallback: string) {
  if (!payload) return fallback;
  if (payload.code && payload.message) return `${payload.code}: ${payload.message}`;
  return payload.message || payload.code || fallback;
}

export function describeMarkdownExportFailure(
  payload: ApiErrorLike | null | undefined,
  status: number
) {
  return `Markdown export failed (HTTP ${status}). ${formatApiError(
    payload,
    FALLBACK_ANALYSIS_MESSAGE
  )}`;
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

async function copyShareLink(url: string): Promise<boolean> {
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
}

async function deliverShareLink(
  url: string
): Promise<ReportShareMethod | "cancelled" | null> {
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
}

export interface ReportActionsState {
  exporting: ExportFormat | null;
  exportError: string | null;
  exportMountActive: boolean;
  setExportNode: (node: HTMLDivElement | null) => void;
  markdownSupport: MarkdownSupportState;
  markdownNote: string | null;
  shareUrl: string | null;
  shareExpiresAt: string | null;
  shareLoading: boolean;
  shareError: string | null;
  shareMessage: string | null;
  handleExportPng: () => Promise<void>;
  handleExportPdf: () => Promise<void>;
  handleExportMarkdown: () => Promise<void>;
  handleShareCandidateBrief: () => Promise<void>;
}

export function useReportActions({
  report,
  reportId,
  variant,
}: {
  report: Report;
  reportId?: string | null;
  variant: ReportVariant;
}): ReportActionsState {
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [shareExpiresAt, setShareExpiresAt] = useState<string | null>(null);
  const [shareLoading, setShareLoading] = useState(false);
  const [shareError, setShareError] = useState<string | null>(null);
  const [shareMessage, setShareMessage] = useState<string | null>(null);
  const [shareCounted, setShareCounted] = useState(false);
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
        setMarkdownNote("Could not verify Markdown export availability. You can still try exporting.");
      }
    };

    void preflightMarkdown();
    return () => {
      alive = false;
    };
  }, [reportId]);

  const waitForExportContent = async () => {
    const deadline = Date.now() + 10_000;
    while (exportRef.current?.querySelector('[data-architecture-state="loading"]')) {
      if (Date.now() > deadline) {
        throw new Error("The architecture map did not finish loading for export.");
      }
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
  };

  const renderExportCanvas = async (scale = 1.5, constrainForPng = false) => {
    setExportMountActive(true);
    await waitForExportMount();
    if (!exportRef.current) {
      setExportMountActive(false);
      throw new Error("Report snapshot is not ready yet.");
    }
    try {
      await waitForExportContent();
      const { default: html2canvas } = await import("html2canvas");
      const resolvedScale = constrainForPng
        ? fitExportCanvasScale(
            exportRef.current.scrollWidth,
            exportRef.current.scrollHeight,
            scale
          )
        : scale;
      return await html2canvas(exportRef.current, {
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
      captureProductEvent("report_exported", { format: "png", report_variant: variant });
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
        context.drawImage(canvas, 0, sourceY, canvas.width, sliceHeight, 0, 0, canvas.width, sliceHeight);

        const blob = await new Promise<Blob | null>((resolve) =>
          slice.toBlob(resolve, "image/png", 1)
        );
        if (!blob) throw new Error("Could not generate a PDF page image.");
        const imageBytes = new Uint8Array(await blob.arrayBuffer());
        const pageRenderHeight = (sliceHeight * renderWidth) / canvas.width;

        if (pageIndex > 0) pdf.addPage();
        pdf.addImage(imageBytes, "PNG", margin, margin, renderWidth, pageRenderHeight, undefined, "FAST");
        slice.width = 1;
        slice.height = 1;
        sourceY += sliceHeight;
      }

      downloadBlob(pdf.output("blob"), `${exportBasename}.pdf`);
      captureProductEvent("report_exported", { format: "pdf", report_variant: variant });
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
      captureProductEvent("report_exported", { format: "markdown", report_variant: variant });
      setMarkdownSupport("available");
      setMarkdownNote(null);
    } catch (error) {
      captureReportExportFailure("markdown", variant, "request_failed");
      setExportError(error instanceof Error ? error.message : "Markdown export failed.");
    } finally {
      setExporting(null);
    }
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
        url = `${window.location.origin}${data.sharePath as string}`;
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

  return {
    exporting,
    exportError,
    exportMountActive,
    setExportNode,
    markdownSupport,
    markdownNote,
    shareUrl,
    shareExpiresAt,
    shareLoading,
    shareError,
    shareMessage,
    handleExportPng,
    handleExportPdf,
    handleExportMarkdown,
    handleShareCandidateBrief,
  };
}
