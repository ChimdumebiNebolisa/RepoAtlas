import type { EvidenceRef } from "@/types/report";
import { canonicalizeKeyDocs } from "../docs";
import { readFileHeaderSnippet } from "../snippets";
import type { BuildCandidateBriefInput, EvidenceIndex } from "./types";

const GENERATED_EVIDENCE_ID =
  /^(?:arch|sem|start|risk|cmd|doc|ci|warn)-\d+$/;

function addEvidence(
  refs: EvidenceRef[],
  ref: Omit<EvidenceRef, "id">,
  prefix: string,
  index: number
): string {
  const id = `${prefix}-${index}`;
  refs.push({ id, ...ref });
  return id;
}

function addDecisionEvidence(
  refs: EvidenceRef[],
  input: BuildCandidateBriefInput
): void {
  const decisionEvidence = input.technicalDecisionEvidence ?? [];
  const decisionEvidenceIdCounts = new Map<string, number>();
  for (const decisionRef of decisionEvidence) {
    decisionEvidenceIdCounts.set(
      decisionRef.id,
      (decisionEvidenceIdCounts.get(decisionRef.id) ?? 0) + 1
    );
  }

  for (const decisionRef of decisionEvidence) {
    if (
      typeof decisionRef.id !== "string" ||
      decisionRef.id.trim().length === 0 ||
      GENERATED_EVIDENCE_ID.test(decisionRef.id) ||
      decisionEvidenceIdCounts.get(decisionRef.id) !== 1 ||
      decisionRef.kind !== "decision" ||
      typeof decisionRef.path !== "string" ||
      decisionRef.path.trim().length === 0
    ) {
      continue;
    }

    if (input.workspacePath) {
      const snippet = readFileHeaderSnippet(
        input.workspacePath,
        decisionRef.path
      );
      if (!snippet) continue;
      refs.push({ ...decisionRef, ...snippet });
    } else {
      refs.push(decisionRef);
    }
  }
}

function addSemanticEvidence(
  refs: EvidenceRef[],
  input: BuildCandidateBriefInput
): void {
  if (!input.semanticGraph) return;

  const stats = input.semanticGraph.stats;
  addEvidence(
    refs,
    {
      kind: "architecture",
      label: "Semantic graph summary",
      detail: `${stats.resolved_internal} internal, ${stats.resolved_external} external, ${stats.unresolved} unresolved edges via ${input.semanticGraph.adapter}.`,
    },
    "arch",
    2
  );
  input.semanticGraph.edges
    .filter((edge) => edge.resolution === "resolved_internal")
    .slice(0, 12)
    .forEach((edge, index) => {
      addEvidence(
        refs,
        {
          kind: "architecture",
          label: `Import ${edge.specifier}`,
          path: edge.evidence.path,
          detail: `${edge.kind} → ${edge.to ?? "unknown"}`,
          line_start: edge.evidence.line_start,
          line_end: edge.evidence.line_end,
          snippet: edge.evidence.snippet,
        },
        "sem",
        index + 1
      );
    });
}

export function buildEvidenceIndex(
  input: BuildCandidateBriefInput
): EvidenceIndex {
  const refs: EvidenceRef[] = [];

  const architectureRef = addEvidence(
    refs,
    {
      kind: "architecture",
      label: "Architecture graph summary",
      detail: `${input.architecture.nodes.length} nodes and ${input.architecture.edges.length} edges detected from supported import/dependency analysis.`,
    },
    "arch",
    1
  );

  addDecisionEvidence(refs, input);
  addSemanticEvidence(refs, input);

  const startHereRefs = new Map<string, string>();
  input.startHere.forEach((item, index) => {
    startHereRefs.set(
      item.path,
      addEvidence(
        refs,
        {
          kind: "start_here",
          label: `Reading candidate: ${item.path}`,
          path: item.path,
          detail: `Priority ${item.score}: ${item.explanation}`,
        },
        "start",
        index + 1
      )
    );
  });

  const dangerZoneRefs = new Map<string, string>();
  input.dangerZones.forEach((item, index) => {
    dangerZoneRefs.set(
      item.path,
      addEvidence(
        refs,
        {
          kind: "danger_zone",
          label: `Risk candidate: ${item.path}`,
          path: item.path,
          detail: `Risk ${item.score}: ${item.breakdown}`,
        },
        "risk",
        index + 1
      )
    );
  });

  const commandRefs = new Map<string, string>();
  input.runCommands.forEach((command, index) => {
    commandRefs.set(
      `${command.source}:${command.command}`,
      addEvidence(
        refs,
        {
          kind: "command",
          label: `Run command: ${command.command}`,
          command: command.command,
          detail: `Source: ${command.source}${command.description ? `; ${command.description}` : ""}`,
        },
        "cmd",
        index + 1
      )
    );
  });

  const { canonicalDocs } = canonicalizeKeyDocs(
    input.contributeSignals.key_docs,
    input.documentInventory
  );
  const docRefs = new Map<string, string>();
  canonicalDocs.forEach((doc, index) => {
    const snippet =
      input.workspacePath && readFileHeaderSnippet(input.workspacePath, doc);
    docRefs.set(
      doc,
      addEvidence(
        refs,
        {
          kind: "doc",
          label: `Project document: ${doc}`,
          path: doc,
          ...snippet,
        },
        "doc",
        index + 1
      )
    );
  });

  const ciRefs = new Map<string, string>();
  input.contributeSignals.ci_configs.forEach((ci, index) => {
    ciRefs.set(
      ci,
      addEvidence(
        refs,
        {
          kind: "ci",
          label: `CI config: ${ci}`,
          path: ci,
        },
        "ci",
        index + 1
      )
    );
  });

  const warningRefs = input.warnings.map((warning, index) =>
    addEvidence(
      refs,
      {
        kind: "warning",
        label: `Analysis warning ${index + 1}`,
        detail: warning,
      },
      "warn",
      index + 1
    )
  );

  return {
    refs,
    architectureRef,
    startHereRefs,
    dangerZoneRefs,
    commandRefs,
    docRefs,
    ciRefs,
    warningRefs,
  };
}
