import type {
  ConfidenceAssessment,
  EvidenceRef,
  TechnicalDecision,
} from "@/types/report";
import { canonicalizeKeyDocs } from "../docs";
import { readFileHeaderSnippet } from "../snippets";
import type {
  BuildCandidateBriefInput,
  Confidence,
  EvidenceIndex,
} from "./types";

const GENERATED_EVIDENCE_ID =
  /^(?:arch|sem|start|risk|cmd|doc|ci|warn)-\d+$/;
const INFORMATIONAL_WARNING_PATTERNS = [
  /^Architecture reduced from file-level \(\d+ files\) to (?:folder|package)-level \(\d+ (?:folders|packages)\)\.$/,
  /^Commit history unavailable for zip uploads without \.git metadata\.$/,
];

export function basename(filePath: string): string {
  const normalized = filePath.replace(/\\/g, "/");
  return normalized.split("/").filter(Boolean).pop() ?? normalized;
}

export function listPaths(paths: string[], emptyText: string): string {
  if (paths.length === 0) return emptyText;
  if (paths.length === 1) return `\`${paths[0]}\``;
  return paths.map((path) => `\`${path}\``).join(", ");
}

export function confidenceFor(input: BuildCandidateBriefInput): Confidence {
  return buildConfidenceAssessment(input).level;
}

export function buildConfidenceAssessment(
  input: BuildCandidateBriefInput
): ConfidenceAssessment {
  const reasons: string[] = [];
  const gaps: string[] = [];
  const materialWarningCount = input.warnings.filter(
    (warning) =>
      !INFORMATIONAL_WARNING_PATTERNS.some((pattern) => pattern.test(warning))
  ).length;

  if (input.contributeSignals.key_docs.some((doc) => /readme/i.test(doc))) {
    reasons.push("README or key docs detected");
  } else gaps.push("No README found");

  if (input.runCommands.length > 0) {
    reasons.push(`${input.runCommands.length} run command(s) extracted`);
  } else gaps.push("No run commands detected");

  if (input.architecture.edges.length > 0) {
    reasons.push("Architecture graph has dependency edges");
  } else gaps.push("No architecture edges");

  const testCount =
    input.testInventory?.test_file_count ??
    (input.testInventory ? 0 : undefined);
  if (testCount !== undefined && testCount > 0) {
    reasons.push(`${testCount} test file(s) detected`);
  } else if (input.startHere.length > 0) {
    gaps.push("Limited or no test files detected");
  }

  if (input.projectPurpose) {
    reasons.push(`Purpose extracted from ${input.projectPurpose.source}`);
  }

  if (input.partial) {
    gaps.push("Analysis stopped before completion");
  }

  if (materialWarningCount > 1) {
    gaps.push("Multiple analysis warnings");
  }

  let level: Confidence = "low";
  if (
    reasons.length >= 4 &&
    gaps.length <= 1 &&
    !input.partial &&
    materialWarningCount <= 1
  ) {
    level = "high";
  } else if (reasons.length >= 2) {
    level = "medium";
  }

  return { level, reasons, gaps };
}

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

export function buildEvidenceIndex(input: BuildCandidateBriefInput): EvidenceIndex {
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

  if (input.semanticGraph) {
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

export function refValues(map: Map<string, string>, limit?: number): string[] {
  const values = Array.from(map.values());
  return typeof limit === "number" ? values.slice(0, limit) : values;
}

export function decisionsWithDirectEvidence(
  input: BuildCandidateBriefInput,
  evidence: EvidenceIndex
): TechnicalDecision[] {
  const uniqueEvidenceById = new Map<string, EvidenceRef | null>();
  for (const ref of evidence.refs) {
    uniqueEvidenceById.set(
      ref.id,
      uniqueEvidenceById.has(ref.id) ? null : ref
    );
  }
  const decisionEvidenceIds = new Set(
    Array.from(uniqueEvidenceById.entries())
      .filter(
        (
          entry
        ): entry is [string, EvidenceRef] =>
          entry[1]?.kind === "decision" &&
          typeof entry[1].path === "string" &&
          entry[1].path.trim().length > 0
      )
      .map(([id]) => id)
  );
  return (input.technicalDecisions ?? []).filter(
    (decision) =>
      decision.evidence_refs.length > 0 &&
      decision.evidence_refs.every((id) => decisionEvidenceIds.has(id))
  );
}

export function firstAvailableRef(index: EvidenceIndex): string {
  return (
    refValues(index.startHereRefs, 1)[0] ??
    refValues(index.dangerZoneRefs, 1)[0] ??
    refValues(index.commandRefs, 1)[0] ??
    refValues(index.docRefs, 1)[0] ??
    refValues(index.ciRefs, 1)[0] ??
    index.warningRefs[0] ??
    index.architectureRef
  );
}
