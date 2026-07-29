import posthog from "posthog-js";

const POSTHOG_PUBLIC_KEY = "phc_z45a8nUZgzk86z9CLN73ogyFSeGbXuaH2jsRn8Dg5ShV";
const POSTHOG_INGEST_HOST = "https://us.i.posthog.com";

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

export function isProductAnalyticsInitialized() {
  return initialized;
}
