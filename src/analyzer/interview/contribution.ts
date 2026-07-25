import type { BriefAnswer, CandidateBrief } from "@/types/report";
import { canonicalizeKeyDocs } from "../docs";
import {
  confidenceFor,
  firstAvailableRef,
} from "./evidence";
import type {
  BuildCandidateBriefInput,
  EvidenceIndex,
  PrIdea,
} from "./types";

function validEvidenceIds(evidence: EvidenceIndex): Set<string> {
  return new Set(evidence.refs.map((ref) => ref.id));
}

function validMapEntries(
  map: Map<string, string>,
  evidence: EvidenceIndex
): Array<[string, string]> {
  const validIds = validEvidenceIds(evidence);
  return Array.from(map.entries()).filter(([, id]) => validIds.has(id));
}

function evidenceBackedPaths(
  paths: string[],
  map: Map<string, string>,
  evidence: EvidenceIndex
): string[] {
  const validEntries = new Map(validMapEntries(map, evidence));
  return Array.from(new Set(paths)).filter((path) => validEntries.has(path));
}

function evidenceBackedCommands(
  input: BuildCandidateBriefInput,
  evidence: EvidenceIndex
): BuildCandidateBriefInput["runCommands"] {
  const validEntries = new Map(validMapEntries(evidence.commandRefs, evidence));
  const seenCommands = new Set<string>();
  return input.runCommands.filter((command) => {
    const key = `${command.source}:${command.command}`;
    if (!validEntries.has(key) || seenCommands.has(command.command)) return false;
    seenCommands.add(command.command);
    return true;
  });
}

function evidenceRefsForKeys(
  keys: string[],
  map: Map<string, string>,
  evidence: EvidenceIndex,
  limit?: number
): string[] {
  const validEntries = new Map(validMapEntries(map, evidence));
  const refs = keys
    .map((key) => validEntries.get(key))
    .filter((ref): ref is string => Boolean(ref));
  return typeof limit === "number" ? refs.slice(0, limit) : refs;
}

function validWarningRefs(evidence: EvidenceIndex): string[] {
  const validIds = validEvidenceIds(evidence);
  return evidence.warningRefs.filter((id) => validIds.has(id));
}

function pushUniqueIdea(ideas: PrIdea[], idea: PrIdea): void {
  if (!ideas.some((existing) => existing.title === idea.title)) {
    ideas.push(idea);
  }
}

export function buildFirstPrPlan(
  input: BuildCandidateBriefInput,
  evidence: EvidenceIndex
): CandidateBrief["first_pr_plan"] {
  const ideas: PrIdea[] = [];
  const topRisk = input.dangerZones.find((item) =>
    evidence.dangerZoneRefs.has(item.path)
  );
  const weakTestRisk = input.dangerZones.find(
    (item) =>
      evidence.dangerZoneRefs.has(item.path) &&
      (item.metrics.test_proximity ?? 100) < 80
  );
  const { canonicalDocs } = canonicalizeKeyDocs(
    input.contributeSignals.key_docs,
    input.documentInventory
  );
  const availableDocs = evidenceBackedPaths(
    canonicalDocs,
    evidence.docRefs,
    evidence
  );
  const docs = availableDocs.slice(0, 2);
  const commands = evidenceBackedCommands(input, evidence);
  const commandKeys = commands.map(
    (command) => `${command.source}:${command.command}`
  );
  const ciConfigs = evidenceBackedPaths(
    input.contributeSignals.ci_configs,
    evidence.ciRefs,
    evidence
  );
  const warnings = validWarningRefs(evidence);

  if (commands.length === 0) {
    pushUniqueIdea(ideas, {
      title: "Document the local run workflow",
      rationale:
        input.runCommands.length === 0
          ? "No run commands were detected, so a small contributor-facing improvement is to document how to install, run, or test the project after confirming the workflow locally."
          : "Run-command metadata was present without inspectable evidence, so confirm the workflow locally before documenting how to install, run, or test the project.",
      suggested_files: docs,
      evidence_refs: [
        ...evidenceRefsForKeys(docs, evidence.docRefs, evidence, 2),
        evidence.architectureRef,
      ],
      risk: "low",
    });
  } else {
    pushUniqueIdea(ideas, {
      title: "Verify and document the detected run commands",
      rationale:
        "The report found run commands; a realistic first PR is to confirm they work and improve nearby setup notes if the current docs are thin.",
      suggested_files: docs,
      evidence_refs: [
        ...evidenceRefsForKeys(
          commandKeys,
          evidence.commandRefs,
          evidence,
          3
        ),
        ...evidenceRefsForKeys(docs, evidence.docRefs, evidence, 2),
      ],
      risk: "low",
    });
  }

  const hasContributionGuide = availableDocs.some((doc) =>
    /(^|\/)CONTRIBUTING(\.[^.]+)?$/i.test(doc)
  );
  if (!hasContributionGuide) {
    pushUniqueIdea(ideas, {
      title: "Add or expand contributor guidance",
      rationale:
        "No CONTRIBUTING guide was detected. A focused first PR can clarify setup, test commands, and how contributors should validate changes.",
      suggested_files: docs,
      evidence_refs: [
        ...evidenceRefsForKeys(docs, evidence.docRefs, evidence, 2),
        ...evidenceRefsForKeys(
          commandKeys,
          evidence.commandRefs,
          evidence,
          2
        ),
      ],
      risk: "low",
    });
  }

  if (weakTestRisk) {
    pushUniqueIdea(ideas, {
      title: `Add tests near ${weakTestRisk.path}`,
      rationale:
        `This file is risk-ranked and has test proximity ${weakTestRisk.metrics.test_proximity ?? 0} (a static signal, not measured coverage), making it a concrete candidate for a small test-focused contribution.`,
      suggested_files: [weakTestRisk.path],
      evidence_refs: [evidence.dangerZoneRefs.get(weakTestRisk.path)!],
      risk: weakTestRisk.score >= 75 ? "medium" : "low",
    });
  } else if (topRisk) {
    pushUniqueIdea(ideas, {
      title: `Map behavior around ${topRisk.path}`,
      rationale:
        "The top danger-zone file is a useful place to add clarifying tests or notes after reading its callers and dependencies.",
      suggested_files: [topRisk.path],
      evidence_refs: [evidence.dangerZoneRefs.get(topRisk.path)!],
      risk: topRisk.score >= 75 ? "medium" : "low",
    });
  }

  if (ciConfigs.length === 0) {
    pushUniqueIdea(ideas, {
      title: "Document or add validation checks",
      rationale:
        input.contributeSignals.ci_configs.length === 0
          ? "No CI config was detected, so a first contribution could document the expected validation command or add a minimal automated check if that matches maintainer expectations."
          : "CI metadata was present without inspectable config evidence, so confirm the validation workflow before documenting it or proposing an automated check.",
      suggested_files: docs,
      evidence_refs: [
        ...evidenceRefsForKeys(docs, evidence.docRefs, evidence, 2),
        evidence.architectureRef,
      ],
      risk: "medium",
    });
  } else {
    pushUniqueIdea(ideas, {
      title: "Align contributor docs with CI validation",
      rationale:
        "CI config is present, so contributor docs can point candidates to the same validation path used by automation.",
      suggested_files: [
        ...docs,
        ...ciConfigs.slice(0, 1),
      ],
      evidence_refs: [
        ...evidenceRefsForKeys(docs, evidence.docRefs, evidence, 2),
        ...evidenceRefsForKeys(ciConfigs, evidence.ciRefs, evidence, 2),
      ],
      risk: "low",
    });
  }

  if (warnings.length > 0) {
    pushUniqueIdea(ideas, {
      title: "Clarify analysis gaps in project docs",
      rationale:
        "The analyzer emitted warnings, so a useful first PR is to clarify repository structure, language support, or validation expectations where the static analysis had limited coverage.",
      suggested_files: docs,
      evidence_refs: [
        ...warnings,
        ...evidenceRefsForKeys(docs, evidence.docRefs, evidence, 2),
      ].slice(0, 4),
      risk: "low",
    });
  }

  const validIds = validEvidenceIds(evidence);
  return ideas.slice(0, 3).map((idea) => ({
    ...idea,
    evidence_refs: (() => {
      const directRefs = idea.evidence_refs.filter((id) => validIds.has(id));
      if (directRefs.length > 0) return directRefs;
      const fallback = firstAvailableRef(evidence);
      return validIds.has(fallback)
        ? [fallback]
        : evidence.refs.slice(0, 1).map((ref) => ref.id);
    })(),
  }));
}

export function buildImproveFirstAnswer(
  firstPrPlan: CandidateBrief["first_pr_plan"]
): BriefAnswer {
  return {
    answer:
      "Improve the repository through small, evidence-backed changes: clarify how to run it, tighten contribution guidance, or add coverage around risk-ranked files.",
    bullets: firstPrPlan.map((idea) => `${idea.title}: ${idea.rationale}`),
    evidence_refs: Array.from(
      new Set(firstPrPlan.flatMap((idea) => idea.evidence_refs))
    ),
    confidence: firstPrPlan.length >= 3 ? "medium" : "low",
  };
}

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
