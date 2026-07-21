import type { BriefAnswer, CandidateBrief } from "@/types/report";
import {
  confidenceFor,
  firstAvailableRef,
  refValues,
} from "./evidence";
import type {
  BuildCandidateBriefInput,
  EvidenceIndex,
  PrIdea,
} from "./types";

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
  const topRisk = input.dangerZones[0];
  const weakTestRisk = input.dangerZones.find(
    (item) => (item.metrics.test_proximity ?? 100) < 80
  );
  const docs = input.contributeSignals.key_docs.slice(0, 2);

  if (input.runCommands.length === 0) {
    pushUniqueIdea(ideas, {
      title: "Document the local run workflow",
      rationale:
        "No run commands were detected, so a small contributor-facing improvement is to document how to install, run, or test the project after confirming the workflow locally.",
      suggested_files: docs,
      evidence_refs: [
        ...refValues(evidence.docRefs, 2),
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
        ...refValues(evidence.commandRefs, 3),
        ...refValues(evidence.docRefs, 2),
      ],
      risk: "low",
    });
  }

  const hasContributionGuide = input.contributeSignals.key_docs.some((doc) =>
    /(^|\/)CONTRIBUTING(\.[^.]+)?$/i.test(doc)
  );
  if (!hasContributionGuide) {
    pushUniqueIdea(ideas, {
      title: "Add or expand contributor guidance",
      rationale:
        "No CONTRIBUTING guide was detected. A focused first PR can clarify setup, test commands, and how contributors should validate changes.",
      suggested_files: docs,
      evidence_refs: [
        ...refValues(evidence.docRefs, 2),
        ...refValues(evidence.commandRefs, 2),
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
      evidence_refs: [
        evidence.dangerZoneRefs.get(weakTestRisk.path) ??
          firstAvailableRef(evidence),
      ],
      risk: weakTestRisk.score >= 75 ? "medium" : "low",
    });
  } else if (topRisk) {
    pushUniqueIdea(ideas, {
      title: `Map behavior around ${topRisk.path}`,
      rationale:
        "The top danger-zone file is a useful place to add clarifying tests or notes after reading its callers and dependencies.",
      suggested_files: [topRisk.path],
      evidence_refs: [
        evidence.dangerZoneRefs.get(topRisk.path) ?? firstAvailableRef(evidence),
      ],
      risk: topRisk.score >= 75 ? "medium" : "low",
    });
  }

  if (input.contributeSignals.ci_configs.length === 0) {
    pushUniqueIdea(ideas, {
      title: "Document or add validation checks",
      rationale:
        "No CI config was detected, so a first contribution could document the expected validation command or add a minimal automated check if that matches maintainer expectations.",
      suggested_files: docs,
      evidence_refs: [
        ...refValues(evidence.docRefs, 2),
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
        ...input.contributeSignals.ci_configs.slice(0, 1),
      ],
      evidence_refs: [
        ...refValues(evidence.docRefs, 2),
        ...refValues(evidence.ciRefs, 2),
      ],
      risk: "low",
    });
  }

  if (input.warnings.length > 0) {
    pushUniqueIdea(ideas, {
      title: "Clarify analysis gaps in project docs",
      rationale:
        "The analyzer emitted warnings, so a useful first PR is to clarify repository structure, language support, or validation expectations where the static analysis had limited coverage.",
      suggested_files: docs,
      evidence_refs: [
        ...evidence.warningRefs,
        ...refValues(evidence.docRefs, 2),
      ].slice(0, 4),
      risk: "low",
    });
  }

  return ideas.slice(0, 3).map((idea) => ({
    ...idea,
    evidence_refs:
      idea.evidence_refs.length > 0
        ? idea.evidence_refs
        : [firstAvailableRef(evidence)],
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
  const firstRead = input.startHere[0]?.path;
  const firstPr = firstPrPlan[0];
  return {
    answer:
      "In the first week, use the reading path to build context, validate the run workflow, inspect the highest-risk files, and propose one small documentation, test, or validation PR.",
    bullets: [
      firstRead
        ? `Day 1: read \`${firstRead}\` and the next ranked files.`
        : "Day 1: inspect the folder map and any available docs.",
      input.runCommands.length > 0
        ? `Validate the detected command path: ${input.runCommands
            .slice(0, 2)
            .map((command) => `\`${command.command}\``)
            .join(", ")}.`
        : "Identify and document the expected local run or test command.",
      input.dangerZones[0]
        ? `Review the top risk-ranked file: \`${input.dangerZones[0].path}\`.`
        : "Use warnings to understand where deep analysis was unavailable.",
      firstPr
        ? `Open with a scoped PR idea: ${firstPr.title}.`
        : "Keep the first PR small and evidence-backed.",
    ],
    evidence_refs: [
      ...refValues(evidence.startHereRefs, 2),
      ...refValues(evidence.commandRefs, 2),
      ...refValues(evidence.dangerZoneRefs, 1),
      ...firstPrPlan.slice(0, 1).flatMap((idea) => idea.evidence_refs),
      ...evidence.warningRefs.slice(0, 1),
    ],
    confidence: confidenceFor(input),
  };
}
