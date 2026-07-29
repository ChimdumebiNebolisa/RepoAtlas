import type { BriefAnswer, CandidateBrief } from "@/types/report";
import { confidenceFor } from "./evidence";
import {
  evidenceBackedCommands,
  evidenceRefsForKeys,
  validEvidenceIds,
  validMapEntries,
  validWarningRefs,
} from "./contributionEvidence";
import type { BuildCandidateBriefInput, EvidenceIndex } from "./types";

export function buildFirstWeekAnswer(
  input: BuildCandidateBriefInput,
  evidence: EvidenceIndex,
  firstPrPlan: CandidateBrief["first_pr_plan"]
): BriefAnswer {
  const startHereRefs = new Map(
    validMapEntries(evidence.startHereRefs, evidence)
  );
  const firstRead = input.startHere.find((item) =>
    startHereRefs.has(item.path)
  )?.path;
  const commands = evidenceBackedCommands(input, evidence);
  const commandKeys = commands.map(
    (command) => `${command.source}:${command.command}`
  );
  const dangerZoneRefs = new Map(
    validMapEntries(evidence.dangerZoneRefs, evidence)
  );
  const topRisk = input.dangerZones.find((item) =>
    dangerZoneRefs.has(item.path)
  );
  const warnings = validWarningRefs(evidence);
  const validIds = validEvidenceIds(evidence);
  const firstPr = firstPrPlan.find(
    (idea) =>
      idea.evidence_refs.length > 0 &&
      idea.evidence_refs.every((id) => validIds.has(id))
  );
  return {
    answer:
      "In the first week, use the reading path to build context, validate the run workflow, inspect the highest-risk files, and propose one small documentation, test, or validation PR.",
    bullets: [
      firstRead
        ? `Day 1: read \`${firstRead}\` and the next ranked files.`
        : "Day 1: inspect the folder map and any available docs.",
      commands.length > 0
        ? `Validate the detected command path: ${commands
            .slice(0, 2)
            .map((command) => `\`${command.command}\``)
            .join(", ")}.`
        : input.runCommands.length > 0
          ? "Confirm the local run or test workflow before documenting it."
          : "Identify and document the expected local run or test command.",
      topRisk
        ? `Review the top risk-ranked file: \`${topRisk.path}\`.`
        : warnings.length > 0
          ? "Use warnings to understand where deep analysis was unavailable."
          : "Use the folder map and confidence notes to choose a well-supported area.",
      firstPr
        ? `Open with a scoped PR idea: ${firstPr.title}.`
        : "Keep the first PR small and evidence-backed.",
    ],
    evidence_refs: [
      ...evidenceRefsForKeys(
        input.startHere.map((item) => item.path),
        evidence.startHereRefs,
        evidence,
        2
      ),
      ...evidenceRefsForKeys(
        commandKeys,
        evidence.commandRefs,
        evidence,
        2
      ),
      ...evidenceRefsForKeys(
        topRisk ? [topRisk.path] : [],
        evidence.dangerZoneRefs,
        evidence,
        1
      ),
      ...(firstPr?.evidence_refs ?? []),
      ...warnings.slice(0, 1),
    ],
    confidence: confidenceFor(input),
  };
}
