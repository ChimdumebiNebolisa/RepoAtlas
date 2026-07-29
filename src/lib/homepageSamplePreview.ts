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
  comparisonProof: {
    readingSequence: string[];
    dangerZone: {
      path: string;
      score: number;
      complexity: number;
      fanOut: number;
    };
  } | null;
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

function hasFiniteNumber(value: number | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value);
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

  const readingSequence = (brief.reading_path ?? [])
    .filter(
      (step) =>
        hasText(step.path) &&
        hasText(step.why) &&
        resolveEvidence(evidenceById, step.evidence_refs) !== null
    )
    .slice(0, 3)
    .map((step) => step.path);
  const dangerZone = report.danger_zones.find(
    (item) =>
      hasText(item.path) &&
      Number.isFinite(item.score) &&
      hasFiniteNumber(item.metrics.complexity) &&
      hasFiniteNumber(item.metrics.fan_out) &&
      (brief.evidence_refs ?? []).some(
        (evidence) =>
          evidence.kind === "danger_zone" &&
          evidence.path === item.path
      )
  );
  const comparisonProof =
    readingSequence.length === 3 && dangerZone
      ? {
          readingSequence,
          dangerZone: {
            path: dangerZone.path,
            score: dangerZone.score,
            complexity: dangerZone.metrics.complexity!,
            fanOut: dangerZone.metrics.fan_out!,
          },
        }
      : null;

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
    comparisonProof,
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
