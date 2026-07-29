import type { AnalysisEntrySource } from "@/lib/analysisAttribution";
import type { ErrorCode } from "@/lib/errors";
import type { AnalysisIntent } from "@/types/report";

export type AnalysisInputType = "zip" | "github" | "sample";
export type ReportShareMethod = "native" | "clipboard";
export type ReportShareType = "stored_link" | "portable_link";
export type ReportExportFormat = "pdf" | "png" | "markdown";
export type ReportVariant = "live" | "preview" | "shared";
export type WalkthroughFormat = "30_second" | "2_minute";
export type ReportExportFailureClass =
  | "render_failed"
  | "http_error"
  | "request_failed";

export type ProductEvent =
  | "route_viewed"
  | "analysis_cta_clicked"
  | "analysis_started"
  | "analysis_completed"
  | "analysis_failed"
  | "report_exported"
  | "report_export_failed"
  | "report_shared"
  | "report_viewed"
  | "walkthrough_copied";

export type StableRouteName =
  | "home"
  | "interview_preparation"
  | "pricing"
  | "report"
  | "shared_report"
  | "other";

export type AnalysisFailureStage =
  | "analysis"
  | "analysis_response"
  | "report_load"
  | "network";

export type AnalysisFailureCode =
  | ErrorCode
  | "INVALID_REPORT_ID"
  | "NETWORK_ERROR";

export type AnalysisEvent =
  | "analysis_started"
  | "analysis_completed"
  | "analysis_failed";

export type ProductEventProperties = {
  route_viewed: {
    route_name: StableRouteName;
  };
  analysis_cta_clicked: {
    source: "interview_preparation";
    destination: "analysis_start";
    entry_source?: AnalysisEntrySource;
  };
  analysis_started: {
    input_type: AnalysisInputType;
    analysis_intent: AnalysisIntent;
    entry_source?: AnalysisEntrySource;
  };
  analysis_completed: {
    input_type: AnalysisInputType;
    analysis_intent: AnalysisIntent;
    entry_source?: AnalysisEntrySource;
  };
  analysis_failed: {
    input_type: AnalysisInputType;
    analysis_intent: AnalysisIntent;
    entry_source?: AnalysisEntrySource;
    stage?: AnalysisFailureStage;
    status_code?: number;
    error_code?: AnalysisFailureCode;
  };
  report_exported: {
    format: ReportExportFormat;
    report_variant: ReportVariant;
  };
  report_export_failed: {
    format: ReportExportFormat;
    report_variant: ReportVariant;
    failure_class: ReportExportFailureClass;
    status?: number;
  };
  report_shared: {
    share_method: ReportShareMethod;
    share_type: ReportShareType;
  };
  report_viewed: {
    report_variant: ReportVariant;
  };
  walkthrough_copied: {
    report_variant: ReportVariant;
    format: WalkthroughFormat;
  };
};

export type AnalysisEventDetails = {
  entry_source?: AnalysisEntrySource;
  stage?: AnalysisFailureStage;
  status_code?: number;
  error_code?: string;
};
