import type { EvidenceRef, TechnicalDecision } from "@/types/report";
import type { BuildCandidateBriefInput, EvidenceIndex } from "./types";

export function basename(filePath: string): string {
  const normalized = filePath.replace(/\\/g, "/");
  return normalized.split("/").filter(Boolean).pop() ?? normalized;
}

export function listPaths(paths: string[], emptyText: string): string {
  if (paths.length === 0) return emptyText;
  if (paths.length === 1) return `\`${paths[0]}\``;
  return paths.map((path) => `\`${path}\``).join(", ");
}

export function refValues(
  map: Map<string, string>,
  limit?: number
): string[] {
  const values = Array.from(map.values());
  return typeof limit === "number" ? values.slice(0, limit) : values;
}

export function decisionsWithDirectEvidence(
  input: BuildCandidateBriefInput,
  evidence: EvidenceIndex
): TechnicalDecision[] {
  const uniqueEvidenceById = new Map<string, EvidenceRef | null>();
  for (const ref of evidence.refs) {
    uniqueEvidenceById.set(
      ref.id,
      uniqueEvidenceById.has(ref.id) ? null : ref
    );
  }
  const decisionEvidenceIds = new Set(
    Array.from(uniqueEvidenceById.entries())
      .filter(
        (entry): entry is [string, EvidenceRef] =>
          entry[1]?.kind === "decision" &&
          typeof entry[1].path === "string" &&
          entry[1].path.trim().length > 0
      )
      .map(([id]) => id)
  );
  return (input.technicalDecisions ?? []).filter(
    (decision) =>
      decision.evidence_refs.length > 0 &&
      decision.evidence_refs.every((id) => decisionEvidenceIds.has(id))
  );
}

export function firstAvailableRef(index: EvidenceIndex): string {
  return (
    refValues(index.startHereRefs, 1)[0] ??
    refValues(index.dangerZoneRefs, 1)[0] ??
    refValues(index.commandRefs, 1)[0] ??
    refValues(index.docRefs, 1)[0] ??
    refValues(index.ciRefs, 1)[0] ??
    index.warningRefs[0] ??
    index.architectureRef
  );
}
