import posthog from "posthog-js";
import type {
  ProductEvent,
  ProductEventProperties,
  StableRouteName,
} from "@/lib/productAnalytics/contracts";
import { isProductAnalyticsInitialized } from "@/lib/productAnalytics/initialization";
import { sanitizeProductEventProperties } from "@/lib/productAnalytics/sanitization";

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
  if (!isProductAnalyticsInitialized()) return;
  const sanitizedProperties = sanitizeProductEventProperties(
    event,
    properties as Record<string, unknown>
  );
  if (!sanitizedProperties) return;
  posthog.capture(event, sanitizedProperties);
}
