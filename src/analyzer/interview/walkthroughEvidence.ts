import type { WalkthroughScript } from "@/types/report";
import {
  decisionsWithDirectEvidence,
  refValues,
} from "./evidence";
import type { BuildCandidateBriefInput, EvidenceIndex } from "./types";

type WalkthroughEvidence = Pick<
  WalkthroughScript,
  "tradeoffs_to_mention" | "improvements_next" | "evidence_refs"
>;

export function buildWalkthroughEvidence(
  input: BuildCandidateBriefInput,
  evidence: EvidenceIndex
): WalkthroughEvidence {
  const evidencedDecisions = decisionsWithDirectEvidence(input, evidence).slice(
    0,
    3
  );
  const tradeoffs = evidencedDecisions.map((decision) => decision.decision);
  const improvements = input.dangerZones
    .slice(0, 2)
    .map((zone) => `Review test proximity and complexity around ${zone.path}`);

  return {
    tradeoffs_to_mention: tradeoffs,
    improvements_next:
      improvements.length > 0
        ? improvements
        : ["Clarify run/test workflow in docs."],
    evidence_refs: [
      ...refValues(evidence.startHereRefs, 2),
      evidence.architectureRef,
      ...refValues(evidence.commandRefs, 1),
      ...evidencedDecisions.flatMap((decision) => decision.evidence_refs),
    ],
  };
}
