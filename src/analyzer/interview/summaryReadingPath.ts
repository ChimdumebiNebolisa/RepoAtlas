import type { CandidateBrief } from "@/types/report";
import { basename, firstAvailableRef } from "./evidence";
import type { BuildCandidateBriefInput, EvidenceIndex } from "./types";

export function buildReadingPath(
  input: BuildCandidateBriefInput,
  evidence: EvidenceIndex
): CandidateBrief["reading_path"] {
  return input.startHere.slice(0, 6).map((item, index) => ({
    order: index + 1,
    title: basename(item.path),
    path: item.path,
    why: item.explanation,
    evidence_refs: [
      evidence.startHereRefs.get(item.path) ?? firstAvailableRef(evidence),
    ],
  }));
}
