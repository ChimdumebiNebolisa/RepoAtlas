import { toAppError } from "@/lib/errors";

/**
 * Build a privacy-safe structured log for failed analyses.
 *
 * Repository URLs, names, refs, filesystem paths, report identifiers, raw
 * upstream messages, and error cause messages are intentionally excluded.
 */
export function analyzeErrorLogPayload(requestId: string, err: unknown) {
  const appErr = toAppError(err);
  const payload: Record<string, unknown> = {
    level: "error",
    requestId,
    code: appErr.code,
    status: appErr.status,
  };

  const upstreamStatus = appErr.meta?.status;
  if (typeof upstreamStatus === "number") payload.upstreamStatus = upstreamStatus;

  const contentLength = appErr.meta?.contentLength ?? appErr.meta?.size;
  if (typeof contentLength === "number") payload.contentLength = contentLength;

  return payload;
}
