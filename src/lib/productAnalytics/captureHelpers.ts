import type { AnalysisIntent } from "@/types/report";
import { captureProductEvent } from "@/lib/productAnalytics/capture";
import type {
  AnalysisEvent,
  AnalysisEventDetails,
  AnalysisInputType,
  ControlledCheckProperties,
  ProductEventProperties,
  ReportExportFailureClass,
  ReportExportFormat,
  ReportShareMethod,
  ReportShareType,
  ReportVariant,
  WalkthroughFormat,
} from "@/lib/productAnalytics/contracts";

const CONTROLLED_CHECK_STORAGE_KEY = "repoatlas-controlled-check";

function controlledCheckProperties(): ControlledCheckProperties {
  try {
    // The release-check browser context seeds this private state directly.
    // Candidate inputs and public URL parameters never participate.
    return typeof window !== "undefined" &&
      window.localStorage?.getItem(CONTROLLED_CHECK_STORAGE_KEY) === "true"
      ? { is_controlled_check: true }
      : {};
  } catch {
    return {};
  }
}

export function captureAnalysisEvent(
  event: AnalysisEvent,
  inputType: AnalysisInputType,
  analysisIntent: AnalysisIntent,
  properties: AnalysisEventDetails = {}
) {
  captureProductEvent(event, {
    ...properties,
    input_type: inputType,
    analysis_intent: analysisIntent,
    ...controlledCheckProperties(),
  } as ProductEventProperties[typeof event]);
}

export function captureReportShared(
  shareMethod: ReportShareMethod,
  shareType: ReportShareType
) {
  captureProductEvent("report_shared", {
    share_method: shareMethod,
    share_type: shareType,
  });
}

export function captureReportViewed(reportVariant: ReportVariant) {
  captureProductEvent("report_viewed", {
    report_variant: reportVariant,
    ...controlledCheckProperties(),
  });
}

export function captureWalkthroughCopied(
  reportVariant: ReportVariant,
  walkthroughFormat: WalkthroughFormat
) {
  captureProductEvent("walkthrough_copied", {
    report_variant: reportVariant,
    format: walkthroughFormat,
    ...controlledCheckProperties(),
  });
}

export function captureReportExportFailure(
  format: ReportExportFormat,
  reportVariant: ReportVariant,
  failureClass: ReportExportFailureClass,
  status?: number
) {
  captureProductEvent("report_export_failed", {
    format,
    report_variant: reportVariant,
    failure_class: failureClass,
    ...(typeof status === "number" ? { status } : {}),
  });
}
