import type { AnalysisFocus } from "@/types/report";
import type { BuildCandidateBriefInput, EvidenceIndex } from "./types";

export function buildAnalysisFocus(
  input: BuildCandidateBriefInput,
  evidence: EvidenceIndex
): AnalysisFocus | undefined {
  const intent = input.analysisIntent ?? "interview";
  if (intent === "interview") return undefined;

  const entry = input.startHere[0];
  const hotspot = input.dangerZones[0];
  const command = input.runCommands[0];
  const entryRef = entry ? evidence.startHereRefs.get(entry.path) : undefined;
  const hotspotRef = hotspot ? evidence.dangerZoneRefs.get(hotspot.path) : undefined;
  const commandRef = command
    ? evidence.commandRefs.get(`${command.source}:${command.command}`)
    : undefined;

  const reviewSteps = [
    {
      title: entry ? `Orient at ${entry.path}` : "Orient from the architecture map",
      detail: entry
        ? "Start with the highest-ranked reading candidate and use its detected role to frame the discussion."
        : "Use the detected architecture summary to establish what RepoAtlas can and cannot trace.",
      evidence_refs: entryRef ? [entryRef] : [evidence.architectureRef],
    },
    {
      title: hotspot
        ? `Inspect the structural hotspot at ${hotspot.path}`
        : "Bound the structural risk",
      detail: hotspot
        ? "Review this risk-ranked file as a place that deserves attention, not as proof of a defect."
        : "No danger-zone file was detected, so keep the discussion tied to architecture and confidence gaps.",
      evidence_refs: hotspotRef ? [hotspotRef] : [evidence.architectureRef],
    },
    {
      title: command
        ? `Plan validation with ${command.command}`
        : "Name the missing validation step",
      detail: command
        ? "Use the repository's detected command as a validation plan. RepoAtlas lists it but does not execute it."
        : "No run command was detected, so confirm the repository's intended validation workflow before changing code.",
      evidence_refs: commandRef ? [commandRef] : [evidence.architectureRef],
    },
  ];

  if (intent === "bug") {
    return {
      intent,
      label: "Bug investigation",
      summary:
        "Trace a reported behavior through likely entry points, structural hotspots, and a bounded validation plan without claiming the repository contains a bug.",
      review_steps: reviewSteps,
      discussion_questions: [
        "Which detected entry point is closest to the reported behavior?",
        "What evidence would separate the root cause from a nearby symptom?",
        "Which focused test would prove the fix without widening the change?",
      ],
    };
  }

  if (intent === "planned_change") {
    return {
      intent,
      label: "Planned change",
      summary:
        "Map where a change would enter the codebase, what structural boundaries it may touch, and how to validate it before implementation.",
      review_steps: reviewSteps,
      discussion_questions: [
        "Which detected entry point should own the new behavior?",
        "What dependencies define the likely blast radius?",
        "What is the smallest evidence-backed change that can be validated?",
      ],
    };
  }

  return {
    intent,
    label: "Pull-request discussion",
    summary:
      "Prepare a file-backed review of the change area, its structural risk, and the validation evidence worth discussing in a pull request.",
    review_steps: reviewSteps,
    discussion_questions: [
      "Which files establish the context a reviewer needs first?",
      "Where could the proposed change cross an observed boundary?",
      "What validation evidence should the pull request include?",
    ],
  };
}
