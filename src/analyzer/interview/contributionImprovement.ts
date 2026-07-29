import type { BriefAnswer, CandidateBrief } from "@/types/report";

export function buildImproveFirstAnswer(
  firstPrPlan: CandidateBrief["first_pr_plan"]
): BriefAnswer {
  return {
    answer:
      "Improve the repository through small, evidence-backed changes: clarify how to run it, tighten contribution guidance, or add coverage around risk-ranked files.",
    bullets: firstPrPlan.map((idea) => `${idea.title}: ${idea.rationale}`),
    evidence_refs: Array.from(
      new Set(firstPrPlan.flatMap((idea) => idea.evidence_refs))
    ),
    confidence: firstPrPlan.length >= 3 ? "medium" : "low",
  };
}
