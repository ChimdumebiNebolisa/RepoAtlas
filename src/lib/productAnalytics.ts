import posthog from "posthog-js";
import {
  analysisEntrySourceValue,
  type AnalysisEntrySource,
} from "@/lib/analysisAttribution";
import { ERROR_CODES, type ErrorCode } from "@/lib/errors";
import { ANALYSIS_INTENTS, type AnalysisIntent } from "@/types/report";
export { analysisEntrySource } from "@/lib/analysisAttribution";

const POSTHOG_PUBLIC_KEY = "phc_z45a8nUZgzk86z9CLN73ogyFSeGbXuaH2jsRn8Dg5ShV";
const POSTHOG_INGEST_HOST = "https://us.i.posthog.com";

export type AnalysisInputType = "zip" | "github" | "sample";
export type ReportShareMethod = "native" | "clipboard";
export type ReportShareType = "stored_link" | "portable_link";
export type ReportExportFormat = "pdf" | "png" | "markdown";
export type ReportVariant = "live" | "preview" | "shared";
export type WalkthroughFormat = "30_second" | "2_minute";
export type ReportExportFailureClass = "render_failed" | "http_error" | "request_failed";

type ProductEvent =
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

type StableRouteName =
  | "home"
  | "interview_preparation"
  | "pricing"
  | "report"
  | "shared_report"
  | "other";
type AnalysisFailureStage =
  | "analysis"
  | "analysis_response"
  | "report_load"
  | "network";
type AnalysisFailureCode = ErrorCode | "INVALID_REPORT_ID" | "NETWORK_ERROR";
type AnalysisEvent =
  | "analysis_started"
  | "analysis_completed"
  | "analysis_failed";

type ProductEventProperties = {
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

type AnalysisEventDetails = {
  entry_source?: AnalysisEntrySource;
  stage?: AnalysisFailureStage;
  status_code?: number;
  error_code?: string;
};

const STABLE_ROUTE_NAMES = [
  "home",
  "interview_preparation",
  "pricing",
  "report",
  "shared_report",
  "other",
] as const;
const ANALYSIS_INPUT_TYPES = ["zip", "github", "sample"] as const;
const ANALYSIS_FAILURE_STAGES = [
  "analysis",
  "analysis_response",
  "report_load",
  "network",
] as const;
const ANALYSIS_FAILURE_CODES = [
  ...Object.values(ERROR_CODES),
  "INVALID_REPORT_ID",
  "NETWORK_ERROR",
] as const;
const REPORT_EXPORT_FORMATS = ["pdf", "png", "markdown"] as const;
const REPORT_VARIANTS = ["live", "preview", "shared"] as const;
const REPORT_EXPORT_FAILURE_CLASSES = [
  "render_failed",
  "http_error",
  "request_failed",
] as const;
const REPORT_SHARE_METHODS = ["native", "clipboard"] as const;
const REPORT_SHARE_TYPES = ["stored_link", "portable_link"] as const;
const WALKTHROUGH_FORMATS = ["30_second", "2_minute"] as const;

let initialized = false;

function isAllowedString<T extends readonly string[]>(
  value: unknown,
  allowed: T
): value is T[number] {
  return typeof value === "string" && allowed.includes(value);
}

function boundedHttpStatus(value: unknown): number | undefined {
  return typeof value === "number" &&
    Number.isInteger(value) &&
    value >= 400 &&
    value <= 599
    ? value
    : undefined;
}

function sanitizedEntrySource(value: unknown): AnalysisEntrySource | undefined {
  return typeof value === "string" ? analysisEntrySourceValue(value) : undefined;
}

function sanitizeAnalysisBase(properties: Record<string, unknown>) {
  if (
    !isAllowedString(properties.input_type, ANALYSIS_INPUT_TYPES) ||
    !isAllowedString(properties.analysis_intent, ANALYSIS_INTENTS)
  ) {
    return null;
  }
  const entrySource = sanitizedEntrySource(properties.entry_source);
  return {
    input_type: properties.input_type,
    analysis_intent: properties.analysis_intent,
    ...(entrySource ? { entry_source: entrySource } : {}),
  };
}

function sanitizeProductEventProperties(
  event: ProductEvent,
  properties: Record<string, unknown>
): ProductEventProperties[ProductEvent] | null {
  switch (event) {
    case "route_viewed":
      return isAllowedString(properties.route_name, STABLE_ROUTE_NAMES)
        ? { route_name: properties.route_name }
        : null;
    case "analysis_cta_clicked": {
      if (
        properties.source !== "interview_preparation" ||
        properties.destination !== "analysis_start"
      ) {
        return null;
      }
      const entrySource = sanitizedEntrySource(properties.entry_source);
      return {
        source: "interview_preparation",
        destination: "analysis_start",
        ...(entrySource ? { entry_source: entrySource } : {}),
      };
    }
    case "analysis_started":
    case "analysis_completed":
      return sanitizeAnalysisBase(properties);
    case "analysis_failed": {
      const base = sanitizeAnalysisBase(properties);
      if (!base) return null;
      const stage = isAllowedString(properties.stage, ANALYSIS_FAILURE_STAGES)
        ? properties.stage
        : undefined;
      const status = boundedHttpStatus(properties.status_code);
      const errorCode = isAllowedString(
        properties.error_code,
        ANALYSIS_FAILURE_CODES
      )
        ? properties.error_code
        : undefined;
      return {
        ...base,
        ...(stage ? { stage } : {}),
        ...(status === undefined ? {} : { status_code: status }),
        ...(errorCode ? { error_code: errorCode } : {}),
      };
    }
    case "report_exported":
      return isAllowedString(properties.format, REPORT_EXPORT_FORMATS) &&
        isAllowedString(properties.report_variant, REPORT_VARIANTS)
        ? {
            format: properties.format,
            report_variant: properties.report_variant,
          }
        : null;
    case "report_export_failed": {
      if (
        !isAllowedString(properties.format, REPORT_EXPORT_FORMATS) ||
        !isAllowedString(properties.report_variant, REPORT_VARIANTS) ||
        !isAllowedString(
          properties.failure_class,
          REPORT_EXPORT_FAILURE_CLASSES
        )
      ) {
        return null;
      }
      const status = boundedHttpStatus(properties.status);
      return {
        format: properties.format,
        report_variant: properties.report_variant,
        failure_class: properties.failure_class,
        ...(status === undefined ? {} : { status }),
      };
    }
    case "report_shared":
      return isAllowedString(properties.share_method, REPORT_SHARE_METHODS) &&
        isAllowedString(properties.share_type, REPORT_SHARE_TYPES)
        ? {
            share_method: properties.share_method,
            share_type: properties.share_type,
          }
        : null;
    case "report_viewed":
      return isAllowedString(properties.report_variant, REPORT_VARIANTS)
        ? { report_variant: properties.report_variant }
        : null;
    case "walkthrough_copied":
      return isAllowedString(properties.report_variant, REPORT_VARIANTS) &&
        isAllowedString(properties.format, WALKTHROUGH_FORMATS)
        ? {
            report_variant: properties.report_variant,
            format: properties.format,
          }
        : null;
    default:
      return null;
  }
}

export function initializeProductAnalytics() {
  if (initialized || typeof window === "undefined") return;

  posthog.init(POSTHOG_PUBLIC_KEY, {
    api_host: POSTHOG_INGEST_HOST,
    defaults: "2025-05-24",
    autocapture: false,
    capture_pageview: false,
    capture_pageleave: false,
    capture_exceptions: false,
    disable_capture_url_hashes: true,
    disable_session_recording: true,
    person_profiles: "identified_only",
    property_denylist: [
      "$current_url",
      "$pathname",
      "$initial_current_url",
      "$session_entry_url",
      "$referrer",
      "$initial_referrer",
    ],
    save_referrer: false,
  });
  initialized = true;
}

export function stableRouteName(pathname: string): StableRouteName {
  if (pathname === "/") return "home";
  if (pathname === "/interview-preparation") return "interview_preparation";
  if (pathname === "/pricing") return "pricing";
  if (pathname.startsWith("/report/")) return "report";
  if (pathname.startsWith("/share/")) return "shared_report";
  return "other";
}

export function captureProductEvent<E extends ProductEvent>(
  event: E,
  properties: ProductEventProperties[E]
) {
  if (!initialized) return;
  const sanitizedProperties = sanitizeProductEventProperties(
    event,
    properties as Record<string, unknown>
  );
  if (!sanitizedProperties) return;
  posthog.capture(event, sanitizedProperties);
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
