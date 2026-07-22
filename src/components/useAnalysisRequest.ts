import { useCallback } from "react";
import type { AnalysisIntent, Report } from "@/types/report";
import { clientFailureDiagnostic } from "@/lib/clientFailureDiagnostics";
import { ERROR_CODES } from "@/lib/errors";
import {
  analysisEntrySource,
  captureAnalysisEvent,
  type AnalysisInputType,
} from "@/lib/productAnalytics";
import {
  FALLBACK_ANALYSIS_MESSAGE,
  formatApiError,
  formatReportFetchError,
  isValidReportId,
} from "./inputFormSupport";

interface UseAnalysisRequestOptions {
  analysisIntent: AnalysisIntent;
  onAnalyzeComplete: (report: Report, reportId: string | null) => void;
  onAnalyzeError: (message: string) => void;
}

export function useAnalysisRequest({
  analysisIntent,
  onAnalyzeComplete,
  onAnalyzeError,
}: UseAnalysisRequestOptions) {
  return useCallback(async (init: RequestInit, inputType: AnalysisInputType) => {
    const entrySource = analysisEntrySource(window.location.search);
    const entryProperties = entrySource ? { entry_source: entrySource } : {};
    captureAnalysisEvent("analysis_started", inputType, analysisIntent, entryProperties);
    try {
      const res = await fetch("/api/analyze", init);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        captureAnalysisEvent("analysis_failed", inputType, analysisIntent, {
          ...entryProperties,
          stage: "analysis",
          status_code: res.status,
          error_code: data.code ?? ERROR_CODES.ANALYSIS_FAILED,
        });
        onAnalyzeError(
          formatApiError(data, FALLBACK_ANALYSIS_MESSAGE, res.headers.get("retry-after"))
        );
        return;
      }

      const { reportId, report: inlineReport, persisted } = data as {
        reportId?: unknown;
        report?: Report;
        persisted?: boolean;
      };
      if (!isValidReportId(reportId)) {
        captureAnalysisEvent("analysis_failed", inputType, analysisIntent, {
          ...entryProperties,
          stage: "analysis_response",
          error_code: "INVALID_REPORT_ID",
        });
        onAnalyzeError("Invalid response: missing or malformed reportId.");
        return;
      }

      if (persisted === false && inlineReport) {
        captureAnalysisEvent("analysis_completed", inputType, analysisIntent, entryProperties);
        onAnalyzeComplete(inlineReport, null);
        return;
      }

      const reportRes = await fetch(`/api/reports/${reportId}`);
      const reportPayload = await reportRes.json().catch(() => ({}));
      if (!reportRes.ok) {
        const diagnostic = clientFailureDiagnostic(
          "report_load",
          reportPayload.code,
          reportRes.status
        );
        captureAnalysisEvent("analysis_failed", inputType, analysisIntent, {
          ...entryProperties,
          stage: "report_load",
          status_code: reportRes.status,
          error_code: diagnostic.errorCode,
        });
        console.error(JSON.stringify(diagnostic));
        onAnalyzeError(formatReportFetchError(reportPayload, reportRes.status, reportId));
        return;
      }

      captureAnalysisEvent("analysis_completed", inputType, analysisIntent, entryProperties);
      onAnalyzeComplete(reportPayload as Report, reportId);
    } catch {
      const diagnostic = clientFailureDiagnostic("network");
      captureAnalysisEvent("analysis_failed", inputType, analysisIntent, {
        ...entryProperties,
        stage: "network",
        error_code: diagnostic.errorCode,
      });
      console.error(JSON.stringify(diagnostic));
      onAnalyzeError("Network error. Please try again.");
    }
  }, [analysisIntent, onAnalyzeComplete, onAnalyzeError]);
}
