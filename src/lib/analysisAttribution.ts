export const CYCLE_3_SOURCE_TOKENS = ["c3p1", "c3p2"] as const;
export const COMPARISON_SOURCE_TOKENS = [
  "comparison_structured_preparation",
  "comparison_ai_summary",
] as const;

export type CycleThreeSourceToken = (typeof CYCLE_3_SOURCE_TOKENS)[number];
export type ComparisonSourceToken = (typeof COMPARISON_SOURCE_TOKENS)[number];
export type AnalysisEntrySource =
  | "interview_preparation"
  | CycleThreeSourceToken
  | ComparisonSourceToken;

const ANALYSIS_ENTRY_SOURCES = new Set<AnalysisEntrySource>([
  "interview_preparation",
  ...CYCLE_3_SOURCE_TOKENS,
  ...COMPARISON_SOURCE_TOKENS,
]);
const CYCLE_3_SOURCE_TOKEN_SET = new Set<CycleThreeSourceToken>(
  CYCLE_3_SOURCE_TOKENS
);

/**
 * Keeps analysis attribution bounded to documented values. Private outreach
 * mappings stay opaque, while public-page values identify only a fixed page type.
 */
export function analysisEntrySourceValue(
  source: string | null | undefined
): AnalysisEntrySource | undefined {
  return source && ANALYSIS_ENTRY_SOURCES.has(source as AnalysisEntrySource)
    ? (source as AnalysisEntrySource)
    : undefined;
}

export function analysisEntrySource(search: string): AnalysisEntrySource | undefined {
  return analysisEntrySourceValue(new URLSearchParams(search).get("source"));
}

export function cycleThreeSourceToken(
  source: string | null | undefined
): CycleThreeSourceToken | undefined {
  return source && CYCLE_3_SOURCE_TOKEN_SET.has(source as CycleThreeSourceToken)
    ? (source as CycleThreeSourceToken)
    : undefined;
}
