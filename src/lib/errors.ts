/**
 * Typed errors and API response mapping for RepoAtlas.
 * Keeps user-facing messages specific for known failures; sanitizes unknown errors.
 */

export const ERROR_CODES = {
  INVALID_INPUT: "INVALID_INPUT",
  INVALID_URL: "INVALID_URL",
  ZIP_NOT_FOUND: "ZIP_NOT_FOUND",
  ZIP_INVALID: "ZIP_INVALID",
  REPO_TOO_LARGE: "REPO_TOO_LARGE",
  CLONE_TIMEOUT: "CLONE_TIMEOUT",
  TIMEOUT: "TIMEOUT",
  REPO_NOT_PUBLIC: "REPO_NOT_PUBLIC",
  CLONE_FAILED: "CLONE_FAILED",
  ANALYSIS_FAILED: "ANALYSIS_FAILED",
} as const;

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];

export interface AppErrorOptions {
  code: ErrorCode;
  status: number;
  message: string;
  expose?: boolean;
  meta?: Record<string, unknown>;
  cause?: unknown;
}

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  readonly expose: boolean;
  readonly meta?: Record<string, unknown>;
  readonly cause?: unknown;

  constructor(options: AppErrorOptions) {
    super(options.message);
    this.name = "AppError";
    this.code = options.code;
    this.status = options.status;
    this.expose = options.expose ?? true;
    this.meta = options.meta;
    this.cause = options.cause;
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

export function isAppError(err: unknown): err is AppError {
  return err instanceof AppError;
}

/** Wrap unknown errors as ANALYSIS_FAILED (500, not exposed). */
export function toAppError(err: unknown): AppError {
  if (isAppError(err)) return err;
  const message = err instanceof Error ? err.message : "Unknown error";
  return new AppError({
    code: ERROR_CODES.ANALYSIS_FAILED,
    status: 500,
    message: "Analysis failed. Check server logs.",
    expose: false,
    meta: { rawMessage: message },
    cause: err,
  });
}

/** User-facing messages for known error codes (per docs/spec.md). */
const USER_MESSAGES: Record<ErrorCode, string> = {
  [ERROR_CODES.INVALID_INPUT]: "Provide githubUrl or zipRef",
  [ERROR_CODES.INVALID_URL]: "Please enter a valid GitHub URL (e.g. https://github.com/owner/repo)",
  [ERROR_CODES.ZIP_NOT_FOUND]: "Zip path not found. Check the path or re-upload.",
  [ERROR_CODES.ZIP_INVALID]: "Invalid or corrupted zip file.",
  [ERROR_CODES.REPO_TOO_LARGE]:
    "Repository exceeds the 100MB limit. Try a smaller repo or a specific branch.",
  [ERROR_CODES.CLONE_TIMEOUT]:
    "Cloning timed out. The repo may be too large or the network slow. Try again or use a smaller repo.",
  [ERROR_CODES.TIMEOUT]:
    "Analysis timed out. The repo may be too large or complex. Try a smaller repo or a specific branch.",
  [ERROR_CODES.REPO_NOT_PUBLIC]:
    "Repository is private or not found. RepoAtlas only analyzes public GitHub repos.",
  [ERROR_CODES.CLONE_FAILED]:
    "Could not clone the repository. Check the URL and that the repo is public.",
  [ERROR_CODES.ANALYSIS_FAILED]: "Analysis failed. Check server logs.",
};

export interface ApiErrorPayload {
  status: number;
  code: string;
  message: string;
}

/** Map a thrown error to API response payload. Always uses curated user-facing messages. */
export function toApiErrorPayload(err: unknown): ApiErrorPayload {
  const appErr = toAppError(err);
  return {
    status: appErr.status,
    code: appErr.code,
    message: USER_MESSAGES[appErr.code],
  };
}
