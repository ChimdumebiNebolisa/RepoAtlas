import type { CandidateBrief } from "@/types/report";
import { canonicalizeKeyDocs } from "../docs";
import { firstAvailableRef } from "./evidence";
import {
  evidenceBackedCommands,
  evidenceBackedPaths,
  evidenceRefsForKeys,
  validEvidenceIds,
  validWarningRefs,
} from "./contributionEvidence";
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
