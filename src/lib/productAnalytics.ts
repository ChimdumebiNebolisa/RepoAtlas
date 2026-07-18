import posthog from "posthog-js";
import type { AnalysisIntent } from "@/types/report";

const POSTHOG_PUBLIC_KEY = "phc_z45a8nUZgzk86z9CLN73ogyFSeGbXuaH2jsRn8Dg5ShV";
const POSTHOG_INGEST_HOST = "https://us.i.posthog.com";

export type AnalysisInputType = "zip" | "github" | "sample";
export type ReportShareMethod = "native" | "clipboard";
export type ReportShareType = "stored_link" | "portable_link";

type ProductEvent =
  | "route_viewed"
  | "analysis_cta_clicked"
  | "analysis_started"
  | "analysis_completed"
  | "analysis_failed"
  | "report_exported"
  | "report_shared";

type ProductEventProperties = Record<
  string,
  string | number | boolean | null | undefined
>;

let initialized = false;

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

export function stableRouteName(pathname: string): string {
  if (pathname === "/") return "home";
  if (pathname === "/interview-preparation") return "interview_preparation";
  if (pathname === "/pricing") return "pricing";
  if (pathname.startsWith("/report/")) return "report";
  if (pathname.startsWith("/share/")) return "shared_report";
  return "other";
}

export function analysisEntrySource(search: string): "interview_preparation" | undefined {
  const source = new URLSearchParams(search).get("source");
  return source === "interview_preparation" ? source : undefined;
}

export function captureProductEvent(
  event: ProductEvent,
  properties: ProductEventProperties = {}
) {
  if (!initialized) return;
  posthog.capture(event, properties);
}

export function captureAnalysisEvent(
  event: Extract<ProductEvent, "analysis_started" | "analysis_completed" | "analysis_failed">,
  inputType: AnalysisInputType,
  analysisIntent: AnalysisIntent,
  properties: ProductEventProperties = {}
) {
  if (!initialized) return;
  posthog.capture(event, {
    ...properties,
    input_type: inputType,
    analysis_intent: analysisIntent,
  });
}

export function captureReportShared(
  shareMethod: ReportShareMethod,
  shareType: ReportShareType
) {
  if (!initialized) return;
  posthog.capture("report_shared", {
    share_method: shareMethod,
    share_type: shareType,
  });
}
