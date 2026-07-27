import { isEvidenceRef } from "./reportSchemaEvidence";
import {
  isConfidence,
  isNonNegativeInteger,
  isObject,
  isOneOf,
  isStringArray,
} from "./reportSchemaPrimitives";

function isBriefAnswer(value: unknown): boolean {
  return (
    isObject(value) &&
    typeof value.answer === "string" &&
    isStringArray(value.bullets) &&
    isStringArray(value.evidence_refs) &&
    isConfidence(value.confidence)
  );
}

function isAnalysisFocus(value: unknown): boolean {
  if (!isObject(value)) return false;
  if (
    !isOneOf(value.intent, [
      "bug",
      "planned_change",
      "pull_request",
    ] as const) ||
    typeof value.label !== "string" ||
    typeof value.summary !== "string" ||
    !Array.isArray(value.review_steps) ||
    !isStringArray(value.discussion_questions)
  ) {
    return false;
  }
  return value.review_steps.every(
    (step) =>
      isObject(step) &&
      typeof step.title === "string" &&
      typeof step.detail === "string" &&
      isStringArray(step.evidence_refs),
  );
}

export function isCandidateBrief(value: unknown): boolean {
  if (!isObject(value) || !isObject(value.repo_summary)) return false;
  if (
    typeof value.repo_summary.headline !== "string" ||
    typeof value.repo_summary.plain_english !== "string" ||
    !isStringArray(value.repo_summary.primary_evidence) ||
    !isConfidence(value.repo_summary.confidence)
  ) {
    return false;
  }

  if (
    !Array.isArray(value.reading_path) ||
    !value.reading_path.every(
      (item) =>
        isObject(item) &&
        isNonNegativeInteger(item.order) &&
        typeof item.title === "string" &&
        typeof item.path === "string" &&
        typeof item.why === "string" &&
        isStringArray(item.evidence_refs),
    )
  ) {
    return false;
  }

  if (!isObject(value.interview_talking_points)) return false;
  for (const key of [
    "walk_me_through_codebase",
    "riskiest_areas",
    "tradeoffs",
    "improve_first",
    "first_week_contribution",
  ] as const) {
    if (!isBriefAnswer(value.interview_talking_points[key])) return false;
  }

  if (
    !Array.isArray(value.first_pr_plan) ||
    !value.first_pr_plan.every(
      (item) =>
        isObject(item) &&
        typeof item.title === "string" &&
        typeof item.rationale === "string" &&
        isStringArray(item.suggested_files) &&
        isStringArray(item.evidence_refs) &&
        isOneOf(item.risk, ["low", "medium", "high"] as const),
    )
  ) {
    return false;
  }

  if (
    !Array.isArray(value.resume_bullets) ||
    !value.resume_bullets.every(
      (item) =>
        isObject(item) &&
        isOneOf(item.audience, ["resume", "linkedin"] as const) &&
        typeof item.text === "string" &&
        isStringArray(item.evidence_refs),
    ) ||
    !Array.isArray(value.evidence_refs) ||
    !value.evidence_refs.every(isEvidenceRef) ||
    !Array.isArray(value.warnings) ||
    !value.warnings.every(
      (warning) =>
        isObject(warning) &&
        typeof warning.message === "string" &&
        (warning.evidence_refs == null || isStringArray(warning.evidence_refs)),
    )
  ) {
    return false;
  }

  if (value.analysis_focus != null && !isAnalysisFocus(value.analysis_focus))
    return false;
  if (value.confidence_assessment != null) {
    const assessment = value.confidence_assessment;
    if (
      !isObject(assessment) ||
      !isConfidence(assessment.level) ||
      !isStringArray(assessment.reasons) ||
      !isStringArray(assessment.gaps)
    ) {
      return false;
    }
  }
  if (value.walkthrough_script != null) {
    const script = value.walkthrough_script;
    if (
      !isObject(script) ||
      typeof script.thirty_second !== "string" ||
      typeof script.two_minute !== "string" ||
      typeof script.deep_technical !== "string" ||
      !isStringArray(script.tradeoffs_to_mention) ||
      !isStringArray(script.improvements_next) ||
      !isStringArray(script.evidence_refs)
    ) {
      return false;
    }
  }
  if (
    value.behavioral_hooks != null &&
    (!Array.isArray(value.behavioral_hooks) ||
      !value.behavioral_hooks.every(
        (hook) =>
          isObject(hook) &&
          typeof hook.prompt === "string" &&
          typeof hook.answer_starter === "string" &&
          isStringArray(hook.evidence_refs) &&
          typeof hook.sufficient_evidence === "boolean",
      ))
  ) {
    return false;
  }
  if (
    value.interview_questions != null &&
    (!Array.isArray(value.interview_questions) ||
      !value.interview_questions.every(
        (question) =>
          isObject(question) &&
          typeof question.question === "string" &&
          typeof question.rationale === "string" &&
          isStringArray(question.evidence_refs) &&
          (question.generic == null || typeof question.generic === "boolean"),
      ))
  ) {
    return false;
  }

  return true;
}
