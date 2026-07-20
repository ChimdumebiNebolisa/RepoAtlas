import { ERROR_CODES, toAppError } from "@/lib/errors";

type LogLevel = "warn" | "error";

function withRequestId(
  payload: Record<string, unknown>,
  requestId?: string
): Record<string, unknown> {
  return requestId ? { ...payload, requestId } : payload;
}

/**
 * Privacy-safe evidence for degraded analysis paths that still return a report.
 * These helpers accept no repository, report, URL, ref, path, or raw-message fields.
 */
export function reportPersistenceFailureLogPayload(requestId?: string) {
  return withRequestId(
    {
      level: "warn" satisfies LogLevel,
      event: "report_persistence_failed",
      failureClass: "storage_unavailable",
      outcome: "inline_report",
    },
    requestId
  );
}

export function partialAnalysisTimeoutLogPayload(requestId?: string) {
  return withRequestId(
    {
      level: "warn" satisfies LogLevel,
      event: "analysis_timeout",
      code: ERROR_CODES.TIMEOUT,
      outcome: "partial_report",
    },
    requestId
  );
}

/** Privacy-safe server evidence for failed stored-report exports. */
export function reportExportErrorLogPayload(requestId: string, err: unknown) {
  const appErr = toAppError(err);
  return {
    level: "error" satisfies LogLevel,
    event: "report_export_failed",
    requestId,
    format: "markdown",
    failureClass: "server_error",
    code: appErr.code,
    status: appErr.status,
  };
}

/** Privacy-safe server evidence for a failed authenticated retention sweep. */
export function retentionCleanupFailureLogPayload(requestId: string) {
  return {
    level: "error" satisfies LogLevel,
    event: "retention_cleanup_failed",
    requestId,
    failureClass: "server_error",
    outcome: "cleanup_incomplete",
  };
}
