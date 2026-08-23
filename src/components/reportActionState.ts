import type { ReportShareMethod } from "@/lib/productAnalytics";
import {
  FALLBACK_ANALYSIS_MESSAGE,
  formatApiError,
} from "./inputFormSupport";

export type MarkdownSupportState = "unknown" | "available" | "unavailable";
export type ExportFormat = "pdf" | "png" | "md";

export const INLINE_MARKDOWN_UNAVAILABLE =
  "Markdown export needs saved report storage, which is currently unavailable. You can still export PDF or PNG.";

export function describeMarkdownExportFailure(
  payload: { code?: string; message?: string } | null | undefined,
  status: number
) {
  return `Markdown export failed (HTTP ${status}). ${formatApiError(
    payload,
    FALLBACK_ANALYSIS_MESSAGE
  )}`;
}

export interface ReportFormatActionsState {
  exporting: ExportFormat | null;
  exportError: string | null;
  exportMountActive: boolean;
  setExportNode: (node: HTMLDivElement | null) => void;
  markdownSupport: MarkdownSupportState;
  markdownNote: string | null;
  handleExportPng: () => Promise<void>;
  handleExportPdf: () => Promise<void>;
  handleExportMarkdown: () => Promise<void>;
}

export interface PrivateReportSharingState {
  shareUrl: string | null;
  shareExpiresAt: string | null;
  shareLoading: boolean;
  shareError: string | null;
  shareMessage: string | null;
  handleShareCandidateBrief: () => Promise<void>;
}

export interface ReportActionsState
  extends ReportFormatActionsState,
    PrivateReportSharingState {}

export type ShareDeliveryResult = ReportShareMethod | "cancelled" | null;
