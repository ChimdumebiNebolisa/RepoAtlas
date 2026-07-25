import type { EvidenceRef, Report } from "@/types/report";

export type HomepageSamplePreview = {
  repositoryName: string;
  confidence: "high" | "medium" | "low";
  summary: string;
  walkthrough: string;
  readingStep: {
    path: string;
    why: string;
    evidence: EvidenceRef | null;
  };
  architecture: {
    explanation: string;
    evidence: EvidenceRef | null;
  };
  interviewerQuestion: {
    question: string;
    rationale: string;
    evidence: EvidenceRef | null;
  };
};

function resolveEvidence(
  evidenceById: Map<string, EvidenceRef>,
  evidenceRefs: string[] | undefined
): EvidenceRef | null {
  for (const evidenceRef of evidenceRefs ?? []) {
    const evidence = evidenceById.get(evidenceRef);
    if (evidence) return evidence;
  }

  return null;
}

function hasText(value: string | undefined): value is string {
  return Boolean(value?.trim());
}

export function buildHomepageSamplePreview(report: Report): HomepageSamplePreview | null {
  const brief = report.candidate_brief;
  const walkthrough = brief?.walkthrough_script;

  if (
    !brief ||
    !walkthrough ||
    !hasText(walkthrough.thirty_second) ||
    !brief.repo_summary ||
    !hasText(brief.repo_summary.plain_english)
  ) {
    return null;
  }

  const evidenceById = new Map(
    (brief.evidence_refs ?? []).map((evidence) => [evidence.id, evidence])
  );
  const readingStep = brief.reading_path?.find(
    (step) =>
      hasText(step.path) &&
      hasText(step.why) &&
      resolveEvidence(evidenceById, step.evidence_refs) !== null
  );

  if (!readingStep) return null;

  const architectureEvidence =
    (walkthrough.evidence_refs ?? [])
      .map((evidenceRef) => evidenceById.get(evidenceRef))
      .find((evidence) => evidence?.kind === "architecture" && hasText(evidence.detail)) ??
    (brief.evidence_refs ?? []).find(
      (evidence) => evidence.kind === "architecture" && hasText(evidence.detail)
    ) ??
    null;
  const interviewQuestions = brief.interview_questions ?? [];
  const evidenceBackedQuestion =
    interviewQuestions.find(
      (question) =>
        !question.generic &&
        hasText(question.question) &&
        hasText(question.rationale) &&
        resolveEvidence(evidenceById, question.evidence_refs) !== null
    ) ??
    interviewQuestions.find(
      (question) =>
        question.generic && hasText(question.question) && hasText(question.rationale)
    );

  if (!evidenceBackedQuestion) return null;

  return {
    repositoryName: report.repo_metadata.name,
    confidence: brief.repo_summary.confidence,
    summary: brief.repo_summary.plain_english,
    walkthrough: walkthrough.thirty_second,
    readingStep: {
      path: readingStep.path,
      why: readingStep.why,
      evidence: resolveEvidence(evidenceById, readingStep.evidence_refs),
    },
    architecture: {
      explanation:
        architectureEvidence?.detail ??
        "This sample does not contain enough supported dependency evidence for a system-flow claim.",
      evidence: architectureEvidence,
    },
    interviewerQuestion: {
      question: evidenceBackedQuestion.question,
      rationale: evidenceBackedQuestion.rationale,
      evidence: evidenceBackedQuestion.generic
        ? null
        : resolveEvidence(evidenceById, evidenceBackedQuestion.evidence_refs),
    },
  };
}
