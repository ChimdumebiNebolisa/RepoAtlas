import { ERROR_CODES } from "@/lib/errors";

export type ClientFailureStage = "report_load" | "network";

const CLIENT_ERROR_CODES = new Set<string>([
  ...Object.values(ERROR_CODES),
  "INVALID_REPORT_ID",
  "NETWORK_ERROR",
]);

/**
 * Build a bounded browser diagnostic for analysis failures.
 *
 * Raw errors, server messages, report identifiers, repository details, and
 * URLs cannot enter the returned shape because this helper accepts none of
 * those values.
 */
export function clientFailureDiagnostic(
  stage: ClientFailureStage,
  code?: unknown,
  status?: unknown
) {
  const fallbackCode = stage === "network" ? "NETWORK_ERROR" : ERROR_CODES.ANALYSIS_FAILED;
  const errorCode =
    typeof code === "string" && CLIENT_ERROR_CODES.has(code) ? code : fallbackCode;
  const boundedStatus =
    typeof status === "number" &&
    Number.isInteger(status) &&
    status >= 400 &&
    status <= 599
      ? status
      : undefined;

  return {
    stage,
    errorCode,
    ...(boundedStatus === undefined ? {} : { status: boundedStatus }),
  };
}
