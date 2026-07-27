import {
  isNonNegativeInteger,
  isObject,
  isOneOf,
  uniqueIds,
} from "./reportSchemaPrimitives";

const EVIDENCE_KINDS = [
  "file",
  "folder",
  "command",
  "doc",
  "ci",
  "architecture",
  "start_here",
  "danger_zone",
  "warning",
  "decision",
  "symbol",
] as const;

export function isEvidenceRef(value: unknown): boolean {
  if (!isObject(value)) return false;
  if (
    typeof value.id !== "string" ||
    !isOneOf(value.kind, EVIDENCE_KINDS) ||
    typeof value.label !== "string"
  ) {
    return false;
  }
  for (const key of ["path", "command", "detail", "snippet"] as const) {
    if (value[key] != null && typeof value[key] !== "string") return false;
  }
  for (const key of ["line_start", "line_end"] as const) {
    if (value[key] != null && !isNonNegativeInteger(value[key])) return false;
  }
  return true;
}

function referencesExist(ids: Set<string>, references: unknown[]): boolean {
  return references.every(
    (reference) => typeof reference === "string" && ids.has(reference),
  );
}

function candidateEvidenceReferences(
  candidate: Record<string, unknown>,
): unknown[] {
  const repoSummary = candidate.repo_summary as Record<string, unknown>;
  const talkingPoints = candidate.interview_talking_points as Record<
    string,
    Record<string, unknown>
  >;
  const references: unknown[] = [
    ...(repoSummary.primary_evidence as unknown[]),
    ...(candidate.reading_path as Array<Record<string, unknown>>).flatMap(
      (item) => item.evidence_refs as unknown[],
    ),
    ...Object.values(talkingPoints).flatMap(
      (answer) => answer.evidence_refs as unknown[],
    ),
    ...(candidate.first_pr_plan as Array<Record<string, unknown>>).flatMap(
      (item) => item.evidence_refs as unknown[],
    ),
    ...(candidate.resume_bullets as Array<Record<string, unknown>>).flatMap(
      (item) => item.evidence_refs as unknown[],
    ),
    ...(candidate.warnings as Array<Record<string, unknown>>).flatMap(
      (warning) => (warning.evidence_refs as unknown[] | undefined) ?? [],
    ),
  ];

  const analysisFocus = candidate.analysis_focus;
  if (isObject(analysisFocus)) {
    references.push(
      ...(analysisFocus.review_steps as Array<Record<string, unknown>>).flatMap(
        (step) => step.evidence_refs as unknown[],
      ),
    );
  }
  const walkthroughScript = candidate.walkthrough_script;
  if (isObject(walkthroughScript)) {
    references.push(...(walkthroughScript.evidence_refs as unknown[]));
  }
  for (const key of ["behavioral_hooks", "interview_questions"] as const) {
    const items = candidate[key];
    if (Array.isArray(items)) {
      references.push(
        ...items.flatMap(
          (item) => (item as Record<string, unknown>).evidence_refs as unknown[],
        ),
      );
    }
  }

  return references;
}

function topLevelEvidenceReferences(report: Record<string, unknown>): unknown[] {
  const references: unknown[] = [];
  for (const key of [
    "project_profile",
    "project_purpose",
    "test_inventory",
    "commit_insights",
  ] as const) {
    const value = report[key];
    if (isObject(value) && Array.isArray(value.evidence_refs)) {
      references.push(...value.evidence_refs);
    }
  }
  if (Array.isArray(report.technical_decisions)) {
    for (const decision of report.technical_decisions) {
      if (isObject(decision) && Array.isArray(decision.evidence_refs)) {
        references.push(...decision.evidence_refs);
      }
    }
  }
  return references;
}

export function hasValidCandidateBriefIntegrity(
  report: Record<string, unknown>,
): boolean {
  const candidate = report.candidate_brief;
  if (!isObject(candidate)) return true;

  const evidence = candidate.evidence_refs as Array<Record<string, unknown>>;
  const evidenceIds = uniqueIds(evidence);
  if (!evidenceIds) return false;

  for (const ref of evidence) {
    if (
      typeof ref.line_start === "number" &&
      typeof ref.line_end === "number" &&
      ref.line_start > ref.line_end
    ) {
      return false;
    }
  }

  return referencesExist(evidenceIds, [
    ...candidateEvidenceReferences(candidate),
    ...topLevelEvidenceReferences(report),
  ]);
}
