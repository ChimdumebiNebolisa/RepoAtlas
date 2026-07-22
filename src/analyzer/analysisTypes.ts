import type { AnalysisIntent, Report } from "@/types/report";

export type AnalyzeInput =
  | {
      kind?: "zip";
      zipRef: string;
      zipName?: string;
      githubUrl?: undefined;
      ref?: undefined;
    }
  | {
      kind: "github";
      githubUrl: string;
      ref?: string;
      zipRef?: undefined;
      zipName?: undefined;
    };

export interface AnalyzeOptions {
  /** Opaque request correlation identifier for privacy-safe diagnostics. */
  requestId?: string;
  /** Bounded job the generated Candidate Brief should be adapted for. */
  analysisIntent?: AnalysisIntent;
  /** Wall-clock budget for analysis. When exceeded after folder map, a partial report is saved. */
  deadlineMs?: number;
  /** Cooperative cancellation for the full request lifecycle. */
  signal?: AbortSignal;
  /** Persist the generated report for later retrieval and sharing. */
  persist?: boolean;
  /** Return the completed report inline when persistence fails. */
  allowInlineFallback?: boolean;
}

export interface AnalyzeResult {
  reportId: string;
  report: Report;
  persisted: boolean;
}

export function githubUrlOf(input: AnalyzeInput): string | undefined {
  return input.githubUrl;
}
