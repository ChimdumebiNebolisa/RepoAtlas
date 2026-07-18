import type {
  Architecture,
  ArchitectureInsights,
  AnalysisFocus,
  AnalysisIntent,
  BehavioralHook,
  BriefAnswer,
  CandidateBrief,
  CodeSymbol,
  CommitInsights,
  ConfidenceAssessment,
  ContributeSignals,
  DangerZoneItem,
  DocumentInventory,
  EvidenceRef,
  InterviewQuestion,
  ProjectProfile,
  ProjectPurpose,
  RunCommand,
  SemanticGraph,
  StartHereItem,
  TechnicalDecision,
  TestInventory,
  WalkthroughScript,
} from "@/types/report";
import { generateInterviewQuestions } from "./questions";
import { readFileHeaderSnippet } from "./snippets";
import { canonicalizeKeyDocs } from "./docs";

type Confidence = "high" | "medium" | "low";
type PrRisk = "low" | "medium" | "high";

export interface BuildCandidateBriefInput {
  repoName: string;
  analysisIntent?: AnalysisIntent;
  startHere: StartHereItem[];
  dangerZones: DangerZoneItem[];
  runCommands: RunCommand[];
  contributeSignals: ContributeSignals;
  architecture: Architecture;
  semanticGraph?: SemanticGraph;
  warnings: string[];
  projectProfile?: ProjectProfile;
  projectPurpose?: ProjectPurpose;
  technicalDecisions?: TechnicalDecision[];
  testInventory?: TestInventory;
  commitInsights?: CommitInsights;
  architectureInsights?: ArchitectureInsights;
  symbols?: CodeSymbol[];
  workspacePath?: string;
  keyDocs?: string[];
  documentInventory?: DocumentInventory;
}

function buildAnalysisFocus(
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
        ? `Start with the highest-ranked reading candidate and use its detected role to frame the discussion.`
        : "Use the detected architecture summary to establish what RepoAtlas can and cannot trace.",
      evidence_refs: entryRef ? [entryRef] : [evidence.architectureRef],
    },
    {
      title: hotspot ? `Inspect the structural hotspot at ${hotspot.path}` : "Bound the structural risk",
      detail: hotspot
        ? "Review this risk-ranked file as a place that deserves attention, not as proof of a defect."
        : "No danger-zone file was detected, so keep the discussion tied to architecture and confidence gaps.",
      evidence_refs: hotspotRef ? [hotspotRef] : [evidence.architectureRef],
    },
    {
      title: command ? `Plan validation with ${command.command}` : "Name the missing validation step",
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

interface EvidenceIndex {
  refs: EvidenceRef[];
  architectureRef: string;
  startHereRefs: Map<string, string>;
  dangerZoneRefs: Map<string, string>;
  commandRefs: Map<string, string>;
  docRefs: Map<string, string>;
  ciRefs: Map<string, string>;
  warningRefs: string[];
}

function basename(filePath: string): string {
  const normalized = filePath.replace(/\\/g, "/");
  return normalized.split("/").filter(Boolean).pop() ?? normalized;
}

function listPaths(paths: string[], emptyText: string): string {
  if (paths.length === 0) return emptyText;
  if (paths.length === 1) return `\`${paths[0]}\``;
  return paths.map((p) => `\`${p}\``).join(", ");
}

function confidenceFor(input: BuildCandidateBriefInput): Confidence {
  const assessment = buildConfidenceAssessment(input);
  return assessment.level;
}

function buildConfidenceAssessment(input: BuildCandidateBriefInput): ConfidenceAssessment {
  const reasons: string[] = [];
  const gaps: string[] = [];

  if (input.contributeSignals.key_docs.some((d) => /readme/i.test(d))) {
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

  if (input.warnings.length > 3) {
    gaps.push("Multiple analysis warnings");
  }

  let level: Confidence = "low";
  if (reasons.length >= 4 && gaps.length <= 1) level = "high";
  else if (reasons.length >= 2) level = "medium";

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

function buildEvidenceIndex(input: BuildCandidateBriefInput): EvidenceIndex {
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
  input.runCommands.forEach((cmd, index) => {
    commandRefs.set(
      `${cmd.source}:${cmd.command}`,
      addEvidence(
        refs,
        {
          kind: "command",
          label: `Run command: ${cmd.command}`,
          command: cmd.command,
          detail: `Source: ${cmd.source}${cmd.description ? `; ${cmd.description}` : ""}`,
        },
        "cmd",
        index + 1
      )
    );
  });

  // Collapse exact/normalized duplicate documents to a single canonical
  // evidence card so equivalent content is not repeated (Phase 3, requirement 9).
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

function refValues(map: Map<string, string>, limit?: number): string[] {
  const values = Array.from(map.values());
  return typeof limit === "number" ? values.slice(0, limit) : values;
}

function firstAvailableRef(index: EvidenceIndex): string {
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

function buildReadingPath(
  startHere: StartHereItem[],
  evidence: EvidenceIndex
): CandidateBrief["reading_path"] {
  return startHere.slice(0, 6).map((item, index) => ({
    order: index + 1,
    title: basename(item.path),
    path: item.path,
    why: item.explanation,
    evidence_refs: [evidence.startHereRefs.get(item.path) ?? firstAvailableRef(evidence)],
  }));
}

function buildRepoSummary(
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
      `Use this brief to discuss the repository from observed files, commands, docs, architecture edges, and risk signals only.`;

  return {
    headline,
    plain_english: plainEnglish,
    primary_evidence: primaryEvidence.length > 0 ? primaryEvidence : [evidence.architectureRef],
    confidence,
  };
}

function buildWalkthroughAnswer(
  input: BuildCandidateBriefInput,
  evidence: EvidenceIndex
): BriefAnswer {
  const readingPaths = input.startHere.slice(0, 3).map((item) => item.path);
  const docs = input.contributeSignals.key_docs.slice(0, 2);
  const commands = input.runCommands.slice(0, 2).map((cmd) => cmd.command);

  const bullets = [
    `Start with ${listPaths(readingPaths, "the available folder map")} because those files were ranked by deterministic reading signals.`,
    `Use ${commands.length ? commands.map((cmd) => `\`${cmd}\``).join(", ") : "the detected project files"} to understand the available run workflow.`,
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

function buildRiskAnswer(
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
    bullets: topRisks.map((item) => `${item.path}: risk ${item.score}; ${item.breakdown}`),
    evidence_refs: topRisks
      .map((item) => evidence.dangerZoneRefs.get(item.path))
      .filter((id): id is string => Boolean(id)),
    confidence: topRisks.length >= 2 ? "high" : "medium",
  };
}

interface PrIdea {
  title: string;
  rationale: string;
  suggested_files: string[];
  evidence_refs: string[];
  risk: PrRisk;
}

function pushUniqueIdea(ideas: PrIdea[], idea: PrIdea): void {
  if (!ideas.some((existing) => existing.title === idea.title)) {
    ideas.push(idea);
  }
}

function existingDocTargets(input: BuildCandidateBriefInput): string[] {
  return input.contributeSignals.key_docs.slice(0, 2);
}

function buildFirstPrPlan(
  input: BuildCandidateBriefInput,
  evidence: EvidenceIndex
): CandidateBrief["first_pr_plan"] {
  const ideas: PrIdea[] = [];
  const topRisk = input.dangerZones[0];
  const weakTestRisk = input.dangerZones.find(
    (item) => (item.metrics.test_proximity ?? 100) < 80
  );
  const docs = existingDocTargets(input);

  if (input.runCommands.length === 0) {
    pushUniqueIdea(ideas, {
      title: "Document the local run workflow",
      rationale:
        "No run commands were detected, so a small contributor-facing improvement is to document how to install, run, or test the project after confirming the workflow locally.",
      suggested_files: docs,
      evidence_refs: [...refValues(evidence.docRefs, 2), evidence.architectureRef],
      risk: "low",
    });
  } else {
    pushUniqueIdea(ideas, {
      title: "Verify and document the detected run commands",
      rationale:
        "The report found run commands; a realistic first PR is to confirm they work and improve nearby setup notes if the current docs are thin.",
      suggested_files: docs,
      evidence_refs: [...refValues(evidence.commandRefs, 3), ...refValues(evidence.docRefs, 2)],
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
      evidence_refs: [...refValues(evidence.docRefs, 2), ...refValues(evidence.commandRefs, 2)],
      risk: "low",
    });
  }

  if (weakTestRisk) {
    pushUniqueIdea(ideas, {
      title: `Add tests near ${weakTestRisk.path}`,
      rationale:
        `This file is risk-ranked and has test proximity ${weakTestRisk.metrics.test_proximity ?? 0} (a static signal, not measured coverage), making it a concrete candidate for a small test-focused contribution.`,
      suggested_files: [weakTestRisk.path],
      evidence_refs: [evidence.dangerZoneRefs.get(weakTestRisk.path) ?? firstAvailableRef(evidence)],
      risk: weakTestRisk.score >= 75 ? "medium" : "low",
    });
  } else if (topRisk) {
    pushUniqueIdea(ideas, {
      title: `Map behavior around ${topRisk.path}`,
      rationale:
        "The top danger-zone file is a useful place to add clarifying tests or notes after reading its callers and dependencies.",
      suggested_files: [topRisk.path],
      evidence_refs: [evidence.dangerZoneRefs.get(topRisk.path) ?? firstAvailableRef(evidence)],
      risk: topRisk.score >= 75 ? "medium" : "low",
    });
  }

  if (input.contributeSignals.ci_configs.length === 0) {
    pushUniqueIdea(ideas, {
      title: "Document or add validation checks",
      rationale:
        "No CI config was detected, so a first contribution could document the expected validation command or add a minimal automated check if that matches maintainer expectations.",
      suggested_files: docs,
      evidence_refs: [...refValues(evidence.docRefs, 2), evidence.architectureRef],
      risk: "medium",
    });
  } else {
    pushUniqueIdea(ideas, {
      title: "Align contributor docs with CI validation",
      rationale:
        "CI config is present, so contributor docs can point candidates to the same validation path used by automation.",
      suggested_files: [...docs, ...input.contributeSignals.ci_configs.slice(0, 1)],
      evidence_refs: [...refValues(evidence.docRefs, 2), ...refValues(evidence.ciRefs, 2)],
      risk: "low",
    });
  }

  if (input.warnings.length > 0) {
    pushUniqueIdea(ideas, {
      title: "Clarify analysis gaps in project docs",
      rationale:
        "The analyzer emitted warnings, so a useful first PR is to clarify repository structure, language support, or validation expectations where the static analysis had limited coverage.",
      suggested_files: docs,
      evidence_refs: [...evidence.warningRefs, ...refValues(evidence.docRefs, 2)].slice(0, 4),
      risk: "low",
    });
  }

  return ideas.slice(0, 3).map((idea) => ({
    ...idea,
    evidence_refs: idea.evidence_refs.length > 0 ? idea.evidence_refs : [firstAvailableRef(evidence)],
  }));
}

function buildImproveFirstAnswer(
  firstPrPlan: CandidateBrief["first_pr_plan"],
  evidence: EvidenceIndex
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

function buildFirstWeekAnswer(
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
            .map((cmd) => `\`${cmd.command}\``)
            .join(", ")}.`
        : "Identify and document the expected local run or test command.",
      input.dangerZones[0]
        ? `Review the top risk-ranked file: \`${input.dangerZones[0].path}\`.`
        : "Use warnings to understand where deep analysis was unavailable.",
      firstPr ? `Open with a scoped PR idea: ${firstPr.title}.` : "Keep the first PR small and evidence-backed.",
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

function buildResumeBullets(
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
    {
      audience: "resume",
      text,
      evidence_refs: evidenceRefs,
    },
    {
      audience: "linkedin",
      text,
      evidence_refs: evidenceRefs,
    },
  ];
}

function buildCandidateWarnings(
  input: BuildCandidateBriefInput,
  evidence: EvidenceIndex
): CandidateBrief["warnings"] {
  const warnings = input.warnings.map((message, index) => ({
    message,
    evidence_refs: [evidence.warningRefs[index] ?? firstAvailableRef(evidence)],
  }));

  if (input.startHere.length === 0) {
    warnings.push({
      message: "No ranked reading path was produced; Candidate Brief confidence is limited.",
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
      message: "No run commands were detected; first-PR ideas avoid claiming a runnable workflow.",
      evidence_refs: [evidence.architectureRef],
    });
  }

  return warnings;
}

function buildWalkthroughScript(
  input: BuildCandidateBriefInput,
  evidence: EvidenceIndex
): WalkthroughScript | undefined {
  const profile = input.projectProfile?.label ?? "this codebase";
  const purpose = input.projectPurpose?.text;
  const topPaths = input.startHere.slice(0, 3).map((s) => s.path);
  const cmds = input.runCommands.slice(0, 2).map((c) => c.command);
  const symbolNames = (input.symbols ?? []).slice(0, 5).map((s) => s.name);

  if (input.startHere.length === 0 && !purpose) {
    return {
      thirty_second: "Not enough evidence for a walkthrough script.",
      two_minute: "Not enough evidence for a walkthrough script.",
      deep_technical: "Not enough evidence.",
      tradeoffs_to_mention: [],
      improvements_next: ["Add README and run commands for stronger briefs."],
      evidence_refs: [evidence.architectureRef],
    };
  }

  const thirty_second =
    `${profile}${purpose ? `: ${purpose.slice(0, 80)}` : ""}. ` +
    `Start at ${topPaths[0] ?? "the folder map"}, validate with ${cmds[0] ?? "detected project files"}.`;

  const two_minute =
    `${thirty_second} Review ${listPaths(topPaths, "ranked files")}, ` +
    `then discuss architecture (${input.architecture.nodes.length} nodes) and top risk file ` +
    `${input.dangerZones[0]?.path ?? "if present"}.`;

  const deep =
    `${two_minute}` +
    (symbolNames.length ? ` Key surfaces include ${symbolNames.join(", ")}.` : "");

  const tradeoffs = (input.technicalDecisions ?? []).slice(0, 3).map((d) => d.decision);
  const improvements = input.dangerZones.slice(0, 2).map(
    (dz) => `Review test proximity and complexity around ${dz.path}`
  );

  return {
    thirty_second,
    two_minute,
    deep_technical: deep,
    tradeoffs_to_mention: tradeoffs,
    improvements_next: improvements.length ? improvements : ["Clarify run/test workflow in docs."],
    evidence_refs: [
      ...refValues(evidence.startHereRefs, 2),
      evidence.architectureRef,
      ...refValues(evidence.commandRefs, 1),
    ],
  };
}

function buildBehavioralHooks(
  input: BuildCandidateBriefInput,
  evidence: EvidenceIndex
): BehavioralHook[] {
  const hooks: BehavioralHook[] = [];

  if (input.dangerZones[0] && (input.testInventory?.test_file_count ?? 0) > 0) {
    hooks.push({
      prompt: "Challenge (STAR template)",
      answer_starter: `Discuss how complexity in \`${input.dangerZones[0].path}\` is managed while tests exist nearby.`,
      evidence_refs: [
        evidence.dangerZoneRefs.get(input.dangerZones[0].path) ?? evidence.architectureRef,
      ],
      sufficient_evidence: true,
    });
  } else {
    hooks.push({
      prompt: "Challenge (STAR template)",
      answer_starter: "Not enough evidence — use a different example or skip this prompt.",
      evidence_refs: [],
      sufficient_evidence: false,
    });
  }

  const decisions = input.technicalDecisions ?? [];
  if (decisions.length >= 2) {
    const decisionRefs = decisions.flatMap((d) => d.evidence_refs).slice(0, 4);
    hooks.push({
      prompt: "Tradeoff (STAR template)",
      answer_starter: `Discuss technical choices such as ${decisions.map((d) => d.decision).join(" and ")} and why they fit the observed repo signals.`,
      evidence_refs:
        decisionRefs.length > 0 ? decisionRefs : [evidence.architectureRef],
      sufficient_evidence: true,
    });
  } else {
    hooks.push({
      prompt: "Tradeoff (STAR template)",
      answer_starter: "Not enough evidence — use a different example or skip this prompt.",
      evidence_refs: [],
      sufficient_evidence: false,
    });
  }

  if (input.warnings.length > 0) {
    hooks.push({
      prompt: "Learning takeaway (STAR template)",
      answer_starter: `Note where static analysis had limited coverage: ${input.warnings[0]}`,
      evidence_refs: evidence.warningRefs.slice(0, 1),
      sufficient_evidence: true,
    });
  }

  if (input.runCommands.length > 0) {
    hooks.push({
      prompt: "Validation approach (STAR template)",
      answer_starter: `Describe validating changes with \`${input.runCommands[0].command}\` and cross-checking nearby docs.`,
      evidence_refs: refValues(evidence.commandRefs, 1),
      sufficient_evidence: true,
    });
  }

  return hooks;
}

export function buildCandidateBrief(input: BuildCandidateBriefInput): CandidateBrief {
  const evidence = buildEvidenceIndex(input);
  const analysis_focus = buildAnalysisFocus(input, evidence);
  const readingPath = buildReadingPath(input.startHere, evidence);
  const firstPrPlan = buildFirstPrPlan(input, evidence);
  const walkThrough = buildWalkthroughAnswer(input, evidence);
  const riskAnswer = buildRiskAnswer(input, evidence);
  const improveFirst = buildImproveFirstAnswer(firstPrPlan, evidence);
  const firstWeek = buildFirstWeekAnswer(input, evidence, firstPrPlan);
  const confidence_assessment = buildConfidenceAssessment(input);
  const walkthrough_script = buildWalkthroughScript(input, evidence);
  const behavioral_hooks = buildBehavioralHooks(input, evidence);
  const interview_questions = generateInterviewQuestions({
    projectProfile: input.projectProfile,
    dangerZones: input.dangerZones,
    dangerZoneEvidenceRefs: Object.fromEntries(evidence.dangerZoneRefs),
    testInventory: input.testInventory,
    architectureInsights: input.architectureInsights,
    architectureEvidenceRef: evidence.architectureRef,
  });

  return {
    analysis_focus,
    repo_summary: buildRepoSummary(input, evidence),
    reading_path: readingPath,
    interview_talking_points: {
      walk_me_through_codebase: walkThrough,
      riskiest_areas: riskAnswer,
      improve_first: improveFirst,
      first_week_contribution: firstWeek,
    },
    first_pr_plan: firstPrPlan,
    resume_bullets: buildResumeBullets(input, evidence),
    evidence_refs: evidence.refs,
    warnings: buildCandidateWarnings(input, evidence),
    confidence_assessment,
    walkthrough_script,
    behavioral_hooks,
    interview_questions,
  };
}
