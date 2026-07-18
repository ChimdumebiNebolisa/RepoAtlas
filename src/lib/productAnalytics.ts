import posthog from "posthog-js";

const POSTHOG_PUBLIC_KEY = "phc_z45a8nUZgzk86z9CLN73ogyFSeGbXuaH2jsRn8Dg5ShV";
const POSTHOG_INGEST_HOST = "https://us.i.posthog.com";

export type AnalysisInputType = "zip" | "github" | "sample";

type ProductEvent =
  | "route_viewed"
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
    disable_session_recording: true,
    person_profiles: "identified_only",
  });
  initialized = true;
}

export function stableRouteName(pathname: string): string {
  if (pathname === "/") return "home";
  if (pathname === "/pricing") return "pricing";
  if (pathname.startsWith("/report/")) return "report";
  if (pathname.startsWith("/share/")) return "shared_report";
  return "other";
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
  properties: ProductEventProperties = {}
) {
  if (!initialized) return;
  posthog.capture(event, { ...properties, input_type: inputType });
}
