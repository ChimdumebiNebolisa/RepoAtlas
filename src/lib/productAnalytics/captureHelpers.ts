import type { AnalysisIntent } from "@/types/report";
import { captureProductEvent } from "@/lib/productAnalytics/capture";
import type {
  AnalysisEvent,
  AnalysisEventDetails,
  AnalysisInputType,
  ProductEventProperties,
  ReportExportFailureClass,
  ReportExportFormat,
  ReportShareMethod,
  ReportShareType,
  ReportVariant,
  WalkthroughFormat,
} from "@/lib/productAnalytics/contracts";

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
  });
}

export function captureWalkthroughCopied(
  reportVariant: ReportVariant,
  walkthroughFormat: WalkthroughFormat
) {
  captureProductEvent("walkthrough_copied", {
    report_variant: reportVariant,
    format: walkthroughFormat,
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
