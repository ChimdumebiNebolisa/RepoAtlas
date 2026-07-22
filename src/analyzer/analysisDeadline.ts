import { AppError, ERROR_CODES } from "@/lib/errors";

export interface DeadlineChecker {
  isExpired(): boolean;
  throwIfAborted(): void;
}

export function createDeadlineChecker(
  deadlineMs?: number,
  signal?: AbortSignal
): DeadlineChecker {
  const start = Date.now();
  return {
    isExpired(): boolean {
      if (signal?.aborted) return true;
      return deadlineMs != null && Date.now() - start >= deadlineMs;
    },
    throwIfAborted(): void {
      if (signal?.aborted) {
        throw new AppError({
          code: ERROR_CODES.TIMEOUT,
          status: 504,
          message: "Analysis timed out.",
        });
      }
    },
  };
}
