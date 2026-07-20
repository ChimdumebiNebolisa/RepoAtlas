import { describe, expect, it } from "vitest";
import {
  partialAnalysisTimeoutLogPayload,
  reportExportErrorLogPayload,
  reportPersistenceFailureLogPayload,
  retentionCleanupFailureLogPayload,
} from "./failureDiagnostics";
import { AppError, ERROR_CODES } from "./errors";

describe("failure diagnostics", () => {
  it("classifies storage fallback without repository or report details", () => {
    expect(reportPersistenceFailureLogPayload("safe-request-id")).toEqual({
      level: "warn",
      event: "report_persistence_failed",
      failureClass: "storage_unavailable",
      outcome: "inline_report",
      requestId: "safe-request-id",
    });
  });

  it("classifies partial analysis timeouts without input details", () => {
    expect(partialAnalysisTimeoutLogPayload("safe-request-id")).toEqual({
      level: "warn",
      event: "analysis_timeout",
      code: "TIMEOUT",
      outcome: "partial_report",
      requestId: "safe-request-id",
    });
  });

  it("keeps stored-export identifiers and raw causes out of server logs", () => {
    const error = new AppError({
      code: ERROR_CODES.ANALYSIS_FAILED,
      status: 500,
      message: "Failed export for private-report-token",
      meta: {
        reportId: "private-report-token",
        githubUrl: "https://github.com/private-owner/private-repository",
      },
      cause: new Error("token=private-secret"),
    });

    const payload = reportExportErrorLogPayload("safe-request-id", error);
    expect(payload).toEqual({
      level: "error",
      event: "report_export_failed",
      requestId: "safe-request-id",
      format: "markdown",
      failureClass: "server_error",
      code: "ANALYSIS_FAILED",
      status: 500,
    });
    expect(JSON.stringify(payload)).not.toMatch(
      /private-owner|private-repository|private-report-token|private-secret/
    );
  });

  it("records retention cleanup failures without stored content", () => {
    expect(retentionCleanupFailureLogPayload("safe-request-id")).toEqual({
      level: "error",
      event: "retention_cleanup_failed",
      requestId: "safe-request-id",
      failureClass: "server_error",
      outcome: "cleanup_incomplete",
    });
  });
});
