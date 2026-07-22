import type { AnalysisIntent } from "@/types/report";
import { ERROR_CODES } from "@/lib/errors";
import { isValidGitRef, parseGithubRepoUrl } from "@/lib/github";

export const FALLBACK_ANALYSIS_MESSAGE = "Analysis failed. Check server logs.";

const UUID_LIKE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type InputMode = "zip" | "github";

export const PRIMARY_ANALYSIS_INTENT: {
  value: AnalysisIntent;
  label: string;
  description: string;
} = {
  value: "interview",
  label: "Interview walkthrough",
  description: "Explain the whole repository clearly.",
};

export const SECONDARY_ANALYSIS_INTENTS: Array<{
  value: AnalysisIntent;
  label: string;
  description: string;
}> = [
  {
    value: "bug",
    label: "Investigate a bug",
    description: "Trace likely entry points and risk signals.",
  },
  {
    value: "planned_change",
    label: "Plan a change",
    description: "Map boundaries, impact, and validation.",
  },
  {
    value: "pull_request",
    label: "Discuss a pull request",
    description: "Prepare a file-backed review path.",
  },
];

interface ApiErrorLike {
  code?: string;
  message?: string;
}

export function formatApiError(
  payload: ApiErrorLike | null | undefined,
  fallback: string,
  retryAfter?: string | null
) {
  if (!payload) return fallback;
  const base = payload.code && payload.message
    ? `${payload.code}: ${payload.message}`
    : payload.message || payload.code || fallback;
  if (
    (payload.code === ERROR_CODES.RATE_LIMITED ||
      payload.code === ERROR_CODES.RATE_LIMIT_EXCEEDED) &&
    retryAfter &&
    /^\d+$/.test(retryAfter)
  ) {
    return `${base} Retry in ${retryAfter} seconds.`;
  }
  return base;
}

export function formatReportFetchError(
  payload: ApiErrorLike | null | undefined,
  status: number,
  reportId: string
) {
  const base = formatApiError(payload, FALLBACK_ANALYSIS_MESSAGE);
  return `Failed to load analysis report (${reportId}, HTTP ${status}). ${base}`;
}

/** Client-side validation mirroring the server's canonical URL rules. */
export function validateGithubInput(url: string, ref: string): string | null {
  if (!url.trim()) return "Enter a public GitHub repository URL.";
  if (!parseGithubRepoUrl(url)) {
    return "Enter a canonical URL like https://github.com/owner/repository.";
  }
  if (ref.trim() && !isValidGitRef(ref)) {
    return "Enter a valid branch or tag name (letters, numbers, ., _, -, /).";
  }
  return null;
}

export function isValidReportId(id: unknown): id is string {
  return typeof id === "string" && UUID_LIKE.test(id.trim());
}
