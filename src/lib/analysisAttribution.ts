export const CYCLE_3_SOURCE_TOKENS = ["c3p1", "c3p2"] as const;

export type CycleThreeSourceToken = (typeof CYCLE_3_SOURCE_TOKENS)[number];
export type AnalysisEntrySource = "interview_preparation" | CycleThreeSourceToken;

const ANALYSIS_ENTRY_SOURCES = new Set<AnalysisEntrySource>([
  "interview_preparation",
  ...CYCLE_3_SOURCE_TOKENS,
]);

/**
 * Keeps analysis attribution bounded to documented, opaque values. The private
 * route-to-token mapping belongs in the outreach record, not in analytics.
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
  const accepted = analysisEntrySourceValue(source);
  return accepted && accepted !== "interview_preparation" ? accepted : undefined;
}
