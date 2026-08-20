import {
  analysisEntrySourceValue,
  type AnalysisEntrySource,
} from "@/lib/analysisAttribution";
import { ERROR_CODES } from "@/lib/errors";
import { ANALYSIS_INTENTS } from "@/types/report";
import type {
  ProductEvent,
  ProductEventProperties,
} from "@/lib/productAnalytics/contracts";

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

function controlledCheckProperties(properties: Record<string, unknown>) {
  return properties.is_controlled_check === true
    ? { is_controlled_check: true as const }
    : {};
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
    ...controlledCheckProperties(properties),
  };
}

export function sanitizeProductEventProperties(
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
        ? {
            report_variant: properties.report_variant,
            ...controlledCheckProperties(properties),
          }
        : null;
    case "walkthrough_copied":
      return isAllowedString(properties.report_variant, REPORT_VARIANTS) &&
        isAllowedString(properties.format, WALKTHROUGH_FORMATS)
        ? {
            report_variant: properties.report_variant,
            format: properties.format,
            ...controlledCheckProperties(properties),
          }
        : null;
    default:
      return null;
  }
}
