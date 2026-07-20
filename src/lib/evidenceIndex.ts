import type { CandidateBrief } from "@/types/report";

export function buildEvidenceUsedByIndex(
  brief: CandidateBrief
): Map<string, string[]> {
  const index = new Map<string, string[]>();

  function add(section: string, ids: string[] | undefined) {
    if (!ids) return;
    for (const id of ids) {
      if (!index.has(id)) index.set(id, []);
      index.get(id)!.push(section);
    }
  }

  add("Repo Summary", brief.repo_summary.primary_evidence);
  for (const step of brief.analysis_focus?.review_steps ?? []) {
    add(`Issue Focus: ${step.title}`, step.evidence_refs);
  }
  for (const item of brief.reading_path) {
    add(`Reading Path: ${item.path}`, item.evidence_refs);
  }
  const tp = brief.interview_talking_points;
  add("Walk me through", tp.walk_me_through_codebase.evidence_refs);
  add("Riskiest areas", tp.riskiest_areas.evidence_refs);
  add("Tradeoffs", tp.tradeoffs?.evidence_refs);
  add("Improve first", tp.improve_first.evidence_refs);
  add("First week", tp.first_week_contribution.evidence_refs);
  add("Walkthrough Script", brief.walkthrough_script?.evidence_refs);
  for (const hook of brief.behavioral_hooks ?? []) {
    add(`Behavioral Hook: ${hook.prompt}`, hook.evidence_refs);
  }
  for (const idea of brief.first_pr_plan) {
    add(`First PR: ${idea.title}`, idea.evidence_refs);
  }
  for (const bullet of brief.resume_bullets) {
    add(`Resume: ${bullet.audience}`, bullet.evidence_refs);
  }

  return index;
}

export function groupEvidenceByKind(
  refs: CandidateBrief["evidence_refs"]
): Record<string, CandidateBrief["evidence_refs"]> {
  const groups: Record<string, typeof refs> = {};
  for (const ref of refs) {
    const kind = ref.kind;
    if (!groups[kind]) groups[kind] = [];
    groups[kind].push(ref);
  }
  return groups;
}
