import type { AnalysisFocus, CandidateBrief } from "@/types/report";
import {
  basename,
  confidenceFor,
  firstAvailableRef,
  refValues,
} from "./evidence";
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

export function buildRepoSummary(
  input: BuildCandidateBriefInput,
  evidence: EvidenceIndex
): CandidateBrief["repo_summary"] {
  const confidence = confidenceFor(input);
  const topStart = input.startHere[0];
  const topRisk = input.dangerZones[0];
  const primaryEvidence = [
    ...(topStart ? [evidence.startHereRefs.get(topStart.path)] : []),
    ...(topRisk ? [evidence.dangerZoneRefs.get(topRisk.path)] : []),
    evidence.architectureRef,
    ...refValues(evidence.commandRefs, 1),
    ...refValues(evidence.docRefs, 1),
  ].filter((id): id is string => Boolean(id));

  const headline = input.projectProfile
    ? `${input.repoName} appears to be a ${input.projectProfile.label}`
    : topStart != null
      ? `${input.repoName} has a ranked reading path starting at ${topStart.path}`
      : `${input.repoName} has limited deterministic onboarding signals`;

  const plainEnglish = input.projectPurpose
    ? `${input.projectPurpose.text} (extracted from ${input.projectPurpose.path}). ` +
      `RepoAtlas also found ${input.startHere.length} reading candidates, ${input.dangerZones.length} risk-ranked files, and ${input.runCommands.length} run commands.`
    : `RepoAtlas found ${input.startHere.length} reading candidates, ` +
      `${input.dangerZones.length} risk-ranked files, ${input.runCommands.length} run commands, ` +
      `${input.contributeSignals.key_docs.length} key docs, and ${input.contributeSignals.ci_configs.length} CI configs. ` +
      "Use this brief to discuss the repository from observed files, commands, docs, architecture edges, and risk signals only.";

  return {
    headline,
    plain_english: plainEnglish,
    primary_evidence:
      primaryEvidence.length > 0 ? primaryEvidence : [evidence.architectureRef],
    confidence,
  };
}

export function buildResumeBullets(
  input: BuildCandidateBriefInput,
  evidence: EvidenceIndex
): CandidateBrief["resume_bullets"] {
  const evidenceRefs = [
    ...refValues(evidence.startHereRefs, 2),
    ...refValues(evidence.dangerZoneRefs, 2),
    ...refValues(evidence.commandRefs, 1),
    evidence.architectureRef,
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
