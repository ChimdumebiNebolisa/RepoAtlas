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

export function buildHomepageSamplePreview(report: Report): HomepageSamplePreview | null {
  const brief = report.candidate_brief;
  const walkthrough = brief?.walkthrough_script;
  const readingStep = brief?.reading_path[0];

  if (!brief || !walkthrough || !readingStep) return null;

  const evidenceById = new Map(brief.evidence_refs.map((evidence) => [evidence.id, evidence]));
  const architectureEvidence =
    walkthrough.evidence_refs
      .map((evidenceRef) => evidenceById.get(evidenceRef))
      .find((evidence) => evidence?.kind === "architecture") ??
    brief.evidence_refs.find((evidence) => evidence.kind === "architecture") ??
    null;
  const evidenceBackedQuestion =
    brief.interview_questions?.find(
      (question) =>
        !question.generic && question.evidence_refs.some((evidenceRef) => evidenceById.has(evidenceRef))
    ) ?? brief.interview_questions?.[0];

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
      evidence: resolveEvidence(evidenceById, evidenceBackedQuestion.evidence_refs),
    },
  };
}
