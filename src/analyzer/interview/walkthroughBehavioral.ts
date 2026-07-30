import type { BehavioralHook } from "@/types/report";
import {
  decisionsWithDirectEvidence,
  refValues,
} from "./evidence";
import type { BuildCandidateBriefInput, EvidenceIndex } from "./types";

export function buildBehavioralHooks(
  input: BuildCandidateBriefInput,
  evidence: EvidenceIndex
): BehavioralHook[] {
  const hooks: BehavioralHook[] = [];

  if (input.dangerZones[0] && (input.testInventory?.test_file_count ?? 0) > 0) {
    hooks.push({
      prompt: "Challenge (STAR template)",
      answer_starter: `Discuss how complexity in \`${input.dangerZones[0].path}\` is managed while tests exist nearby.`,
      evidence_refs: [
        evidence.dangerZoneRefs.get(input.dangerZones[0].path) ??
          evidence.architectureRef,
      ],
      sufficient_evidence: true,
    });
  } else {
    hooks.push({
      prompt: "Challenge (STAR template)",
      answer_starter:
        "Not enough evidence. Use a different example or skip this prompt.",
      evidence_refs: [],
      sufficient_evidence: false,
    });
  }

  const decisions = decisionsWithDirectEvidence(input, evidence);
  if (decisions.length >= 2) {
    const displayedDecisions = decisions.slice(0, 3);
    const decisionRefs = displayedDecisions
      .flatMap((decision) => decision.evidence_refs)
      .slice(0, 4);
    hooks.push({
      prompt: "Tradeoff (STAR template)",
      answer_starter: `Use ${displayedDecisions.map((decision) => decision.decision).join(" and ")} as directly evidenced technical choices. Separate what the files prove from questions about rationale, alternatives, and runtime effects.`,
      evidence_refs: decisionRefs,
      sufficient_evidence: true,
    });
  } else {
    hooks.push({
      prompt: "Tradeoff (STAR template)",
      answer_starter:
        "Not enough evidence. Use a different example or skip this prompt.",
      evidence_refs: [],
      sufficient_evidence: false,
    });
  }

  if (input.warnings.length > 0) {
    hooks.push({
      prompt: "Learning takeaway (STAR template)",
      answer_starter: `Note where static analysis had limited coverage: ${input.warnings[0]}`,
      evidence_refs: evidence.warningRefs.slice(0, 1),
      sufficient_evidence: true,
    });
  }

  if (input.runCommands.length > 0) {
    hooks.push({
      prompt: "Validation approach (STAR template)",
      answer_starter: `Describe validating changes with \`${input.runCommands[0].command}\` and cross-checking nearby docs.`,
      evidence_refs: refValues(evidence.commandRefs, 1),
      sufficient_evidence: true,
    });
  }

  return hooks;
}
