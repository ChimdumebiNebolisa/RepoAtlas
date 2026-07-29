import type { CandidateBrief, EvidenceRef } from "@/types/report";
import type { BuildCandidateBriefInput, EvidenceIndex } from "./types";

export function buildResumeBullets(
  input: BuildCandidateBriefInput,
  evidence: EvidenceIndex
): CandidateBrief["resume_bullets"] {
  const evidenceById = new Map(evidence.refs.map((ref) => [ref.id, ref]));
  const supportedStartHere = supportedMappedEvidence(
    input.startHere,
    evidence.startHereRefs,
    (item) => item.path,
    evidenceById,
    (item, ref) =>
      item.path.trim().length > 0 &&
      ref.kind === "start_here" &&
      ref.path === item.path
  );
  const supportedDangerZones = supportedMappedEvidence(
    input.dangerZones,
    evidence.dangerZoneRefs,
    (item) => item.path,
    evidenceById,
    (item, ref) =>
      item.path.trim().length > 0 &&
      ref.kind === "danger_zone" &&
      ref.path === item.path
  );
  const supportedCommands = supportedMappedEvidence(
    input.runCommands,
    evidence.commandRefs,
    (command) => `${command.source}:${command.command}`,
    evidenceById,
    (command, ref) =>
      command.source.trim().length > 0 &&
      command.command.trim().length > 0 &&
      ref.kind === "command" &&
      ref.command === command.command
  );
  const architectureEvidence = evidenceById.get(evidence.architectureRef);
  const supportedArchitectureRef =
    architectureEvidence?.kind === "architecture"
      ? evidence.architectureRef
      : undefined;
  const hasCompleteEvidence =
    supportedStartHere.complete &&
    supportedDangerZones.complete &&
    supportedCommands.complete &&
    supportedArchitectureRef != null;
  const hasSpecificEvidence =
    supportedStartHere.refs.length > 0 ||
    supportedDangerZones.refs.length > 0 ||
    supportedCommands.refs.length > 0 ||
    (supportedArchitectureRef != null && input.architecture.nodes.length > 0);

  if (!hasCompleteEvidence || !hasSpecificEvidence) {
    const claims = [
      countClaim(
        supportedStartHere.refs.length,
        "reading candidate",
        "reading candidates"
      ),
      countClaim(
        supportedDangerZones.refs.length,
        "risk-ranked file",
        "risk-ranked files"
      ),
      countClaim(
        supportedCommands.refs.length,
        "run command",
        "run commands"
      ),
      supportedArchitectureRef && input.architecture.nodes.length > 0
        ? countClaim(
            input.architecture.nodes.length,
            "architecture node",
            "architecture nodes"
          )
        : undefined,
    ].filter((claim): claim is string => claim != null);
    const evidenceRefs = [
      ...supportedStartHere.refs.slice(0, 2),
      ...supportedDangerZones.refs.slice(0, 2),
      ...supportedCommands.refs.slice(0, 1),
      ...(supportedArchitectureRef ? [supportedArchitectureRef] : []),
    ];
    const text =
      claims.length > 0
        ? `Prepared an evidence-linked technical brief from RepoAtlas static analysis, based on ${claims.join(", ")}.`
        : "Prepared a repository walkthrough from static analysis, without claiming unverified authorship, runtime behavior, or business impact.";

    return [
      { audience: "resume", text, evidence_refs: evidenceRefs },
      { audience: "linkedin", text, evidence_refs: evidenceRefs },
    ];
  }

  const evidenceRefs = [
    ...supportedStartHere.refs.slice(0, 2),
    ...supportedDangerZones.refs.slice(0, 2),
    ...supportedCommands.refs.slice(0, 1),
    supportedArchitectureRef,
  ];
  const text =
    `Analyzed ${input.repoName} with RepoAtlas-style static signals, mapping ` +
    `${input.startHere.length} reading candidates, ${input.dangerZones.length} risk-ranked files, ` +
    `${input.runCommands.length} run commands, and ${input.architecture.nodes.length} architecture nodes into an interview-ready technical brief.`;

  return [
    { audience: "resume", text, evidence_refs: evidenceRefs },
    { audience: "linkedin", text, evidence_refs: evidenceRefs },
  ];
}

function supportedMappedEvidence<T>(
  items: T[],
  refsByKey: Map<string, string>,
  keyFor: (item: T) => string,
  evidenceById: Map<string, EvidenceRef>,
  supports: (item: T, ref: EvidenceRef) => boolean
): { complete: boolean; refs: string[] } {
  const seenKeys = new Set<string>();
  const refs: string[] = [];
  let complete = true;

  for (const item of items) {
    const key = keyFor(item);
    if (seenKeys.has(key)) {
      complete = false;
      continue;
    }
    seenKeys.add(key);

    const refId = refsByKey.get(key);
    const ref = refId ? evidenceById.get(refId) : undefined;
    if (!refId || !ref || !supports(item, ref)) {
      complete = false;
      continue;
    }
    refs.push(refId);
  }

  return { complete, refs };
}

function countClaim(count: number, singular: string, plural: string) {
  if (count === 0) return undefined;
  return `${count} ${count === 1 ? singular : plural}`;
}
