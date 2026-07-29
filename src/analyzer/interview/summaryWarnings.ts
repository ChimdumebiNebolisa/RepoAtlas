import type { CandidateBrief } from "@/types/report";
import { firstAvailableRef } from "./evidence";
import type { BuildCandidateBriefInput, EvidenceIndex } from "./types";

export function buildCandidateWarnings(
  input: BuildCandidateBriefInput,
  evidence: EvidenceIndex
): CandidateBrief["warnings"] {
  const warnings = input.warnings.map((message, index) => ({
    message,
    evidence_refs: [
      evidence.warningRefs[index] ?? firstAvailableRef(evidence),
    ],
  }));

  if (input.startHere.length === 0) {
    warnings.push({
      message:
        "No ranked reading path was produced; Candidate Brief confidence is limited.",
      evidence_refs: [evidence.architectureRef],
    });
  }
  if (input.dangerZones.length === 0) {
    warnings.push({
      message: "No danger-zone files were produced; risk talking points are limited.",
      evidence_refs: [evidence.architectureRef],
    });
  }
  if (input.runCommands.length === 0) {
    warnings.push({
      message:
        "No run commands were detected; first-PR ideas avoid claiming a runnable workflow.",
      evidence_refs: [evidence.architectureRef],
    });
  }

  return warnings;
}
