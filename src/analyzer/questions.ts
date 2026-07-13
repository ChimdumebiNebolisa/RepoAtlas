import type {
  ArchitectureInsights,
  DangerZoneItem,
  ProjectProfile,
  TestInventory,
  InterviewQuestion,
} from "@/types/report";

export interface QuestionGeneratorInput {
  projectProfile?: ProjectProfile;
  dangerZones: DangerZoneItem[];
  testInventory?: TestInventory;
  architectureInsights?: ArchitectureInsights;
}

export function generateInterviewQuestions(
  input: QuestionGeneratorInput
): InterviewQuestion[] {
  const questions: InterviewQuestion[] = [];

  if (input.projectProfile) {
    questions.push({
      question: `Why does this appear to be a ${input.projectProfile.label}?`,
      rationale: "Project type is derived from detected files and dependencies.",
      evidence_refs: input.projectProfile.evidence_refs,
    });
  }

  if (input.dangerZones[0]) {
    const dz = input.dangerZones[0];
    questions.push({
      question: `What makes \`${dz.path}\` a danger zone in this codebase?`,
      rationale: "Top risk-ranked file with measurable breakdown.",
      evidence_refs: [],
    });
  }

  if (input.testInventory?.untested_high_risk_files[0]) {
    const target = input.testInventory.untested_high_risk_files[0];
    questions.push({
      question: `What tests would you add near \`${target}\`?`,
      rationale: "High-risk file with low test proximity (a static signal, not measured coverage).",
      evidence_refs: input.testInventory.evidence_refs,
    });
  }

  questions.push({
    question: "What are the limits of static analysis for this repository?",
    rationale: "Warnings and missing git history bound confidence.",
    evidence_refs: [],
  });

  if (input.architectureInsights?.violations[0]) {
    const v = input.architectureInsights.violations[0];
    questions.push({
      question: `Why might importing from \`${v.to}\` into \`${v.from}\` be worth discussing?`,
      rationale: v.reason,
      evidence_refs: [],
    });
  }

  return questions.slice(0, 10);
}
