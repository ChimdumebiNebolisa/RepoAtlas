import type { CandidateBrief } from "@/types/report";
import {
  buildFirstPrPlan,
  buildFirstWeekAnswer,
  buildImproveFirstAnswer,
} from "./interview/contribution";
import {
  buildConfidenceAssessment,
  buildEvidenceIndex,
} from "./interview/evidence";
import {
  buildAnalysisFocus,
  buildCandidateWarnings,
  buildReadingPath,
  buildRepoSummary,
  buildResumeBullets,
} from "./interview/summary";
import {
  buildRiskAnswer,
  buildTradeoffAnswer,
  buildWalkthroughAnswer,
} from "./interview/talking-points";
import type { BuildCandidateBriefInput } from "./interview/types";
import {
  buildBehavioralHooks,
  buildWalkthroughScript,
} from "./interview/walkthrough";
import { generateInterviewQuestions } from "./questions";

export type { BuildCandidateBriefInput } from "./interview/types";

export function buildCandidateBrief(
  input: BuildCandidateBriefInput
): CandidateBrief {
  const evidence = buildEvidenceIndex(input);
  const firstPrPlan = buildFirstPrPlan(input, evidence);

  return {
    analysis_focus: buildAnalysisFocus(input, evidence),
    repo_summary: buildRepoSummary(input, evidence),
    reading_path: buildReadingPath(input, evidence),
    interview_talking_points: {
      walk_me_through_codebase: buildWalkthroughAnswer(input, evidence),
      riskiest_areas: buildRiskAnswer(input, evidence),
      tradeoffs: buildTradeoffAnswer(input, evidence),
      improve_first: buildImproveFirstAnswer(firstPrPlan),
      first_week_contribution: buildFirstWeekAnswer(
        input,
        evidence,
        firstPrPlan
      ),
    },
    first_pr_plan: firstPrPlan,
    resume_bullets: buildResumeBullets(input, evidence),
    evidence_refs: evidence.refs,
    warnings: buildCandidateWarnings(input, evidence),
    confidence_assessment: buildConfidenceAssessment(input),
    walkthrough_script: buildWalkthroughScript(input, evidence),
    behavioral_hooks: buildBehavioralHooks(input, evidence),
    interview_questions: generateInterviewQuestions({
      projectProfile: input.projectProfile,
      dangerZones: input.dangerZones,
      dangerZoneEvidenceRefs: Object.fromEntries(evidence.dangerZoneRefs),
      testInventory: input.testInventory,
      architectureInsights: input.architectureInsights,
      architectureEvidenceRef: evidence.architectureRef,
    }),
  };
}
