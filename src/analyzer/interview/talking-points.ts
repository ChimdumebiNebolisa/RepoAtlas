import type { BriefAnswer } from "@/types/report";
import {
  confidenceFor,
  decisionsWithDirectEvidence,
  listPaths,
  refValues,
} from "./evidence";
import type { BuildCandidateBriefInput, EvidenceIndex } from "./types";

export function buildWalkthroughAnswer(
  input: BuildCandidateBriefInput,
  evidence: EvidenceIndex
): BriefAnswer {
  const readingPaths = input.startHere.slice(0, 3).map((item) => item.path);
  const docs = input.contributeSignals.key_docs.slice(0, 2);
  const commands = input.runCommands.slice(0, 2).map((command) => command.command);

  const bullets = [
    `Start with ${listPaths(readingPaths, "the available folder map")} because those files were ranked by deterministic reading signals.`,
    `Use ${commands.length ? commands.map((command) => `\`${command}\``).join(", ") : "the detected project files"} to understand the available run workflow.`,
    `Reference ${listPaths(docs, "the detected repository structure")} for onboarding or contribution context.`,
    `Describe the architecture as ${input.architecture.nodes.length} graph nodes and ${input.architecture.edges.length} graph edges from supported import/dependency analysis.`,
  ];

  return {
    answer:
      "Walk through the repository from the ranked reading path, then connect that path to run commands, docs, and the architecture graph. Keep the explanation tied to detected files and commands.",
    bullets,
    evidence_refs: [
      ...refValues(evidence.startHereRefs, 3),
      ...refValues(evidence.commandRefs, 2),
      ...refValues(evidence.docRefs, 2),
      evidence.architectureRef,
    ],
    confidence: confidenceFor(input),
  };
}

export function buildRiskAnswer(
  input: BuildCandidateBriefInput,
  evidence: EvidenceIndex
): BriefAnswer {
  const topRisks = input.dangerZones.slice(0, 3);
  if (topRisks.length === 0) {
    return {
      answer:
        "RepoAtlas did not produce danger-zone files for this repository, so risk discussion should stay limited to warnings and missing deep-analysis coverage.",
      bullets: [
        "No danger-zone rows were available.",
        `Architecture evidence is limited to ${input.architecture.nodes.length} nodes and ${input.architecture.edges.length} edges.`,
      ],
      evidence_refs: [evidence.architectureRef, ...evidence.warningRefs],
      confidence: "low",
    };
  }

  return {
    answer:
      "The riskiest areas are the top danger-zone files because they combine measurable signals such as size, fan-in, fan-out, complexity, and test proximity.",
    bullets: topRisks.map(
      (item) => `${item.path}: risk ${item.score}; ${item.breakdown}`
    ),
    evidence_refs: topRisks
      .map((item) => evidence.dangerZoneRefs.get(item.path))
      .filter((id): id is string => Boolean(id)),
    confidence: topRisks.length >= 2 ? "high" : "medium",
  };
}

export function buildTradeoffAnswer(
  input: BuildCandidateBriefInput,
  evidence: EvidenceIndex
): BriefAnswer {
  const decisions = decisionsWithDirectEvidence(input, evidence).slice(0, 3);

  if (decisions.length < 2) {
    return {
      answer:
        "This repository does not provide enough direct evidence for a defensible tradeoff answer.",
      bullets: [
        "Each named technical choice must resolve to a manifest or configuration file.",
        "The brief does not infer maintainer intent, rejected alternatives, or production behavior.",
      ],
      evidence_refs: Array.from(
        new Set(decisions.flatMap((decision) => decision.evidence_refs))
      ),
      confidence: "low",
    };
  }

  return {
    answer: `The repository directly shows ${decisions.map((decision) => decision.decision).join(", ")} as technical choices. These are defensible places to discuss tradeoffs, but the files do not prove why maintainers chose them or what alternatives they rejected.`,
    bullets: decisions.map(
      (decision) =>
        `${decision.category}: ${decision.decision}. The evidence supports the choice itself, not its motivation or runtime effect.`
    ),
    evidence_refs: Array.from(
      new Set(decisions.flatMap((decision) => decision.evidence_refs))
    ),
    confidence: decisions.length >= 3 ? "high" : "medium",
  };
}
