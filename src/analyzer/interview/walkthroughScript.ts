import type { WalkthroughScript } from "@/types/report";
import type { BuildCandidateBriefInput, EvidenceIndex } from "./types";
import { buildWalkthroughEvidence } from "./walkthroughEvidence";
import { buildWalkthroughText } from "./walkthroughText";

export function buildWalkthroughScript(
  input: BuildCandidateBriefInput,
  evidence: EvidenceIndex
): WalkthroughScript | undefined {
  const purpose = input.projectPurpose?.text;

  if (input.startHere.length === 0 && !purpose) {
    return {
      thirty_second: "Not enough evidence for a walkthrough script.",
      two_minute: "Not enough evidence for a walkthrough script.",
      deep_technical: "Not enough evidence.",
      tradeoffs_to_mention: [],
      improvements_next: ["Add README and run commands for stronger briefs."],
      evidence_refs: [evidence.architectureRef],
    };
  }

  return {
    ...buildWalkthroughText(input),
    ...buildWalkthroughEvidence(input, evidence),
  };
}
