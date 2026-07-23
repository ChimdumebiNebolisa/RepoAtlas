/**
 * Runtime validation for stored report JSON — versioned, deep shape checks.
 */

import type { Report } from "@/types/report";
import { ANALYSIS_INTENTS, REPORT_VERSION } from "@/types/report";

export type ReportLoadResult =
  | { ok: true; report: Report }
  | { ok: false; reason: "corrupt" | "incompatible" };

const MAX_FOLDER_VALIDATION_DEPTH = 64;

const EVIDENCE_KINDS = [
  "file",
  "folder",
  "command",
  "doc",
  "ci",
  "architecture",
  "start_here",
  "danger_zone",
  "warning",
  "decision",
  "symbol",
] as const;

const SEMANTIC_NODE_KINDS = [
  "file",
  "package",
  "module",
  "declaration",
  "entrypoint",
] as const;
const SEMANTIC_EDGE_KINDS = [
  "import",
  "dynamic_import",
  "require",
  "re_export",
  "package_dependency",
] as const;
const RESOLUTION_STATUSES = [
  "resolved_internal",
  "resolved_external",
  "unresolved",
  "ignored",
] as const;

function isObject(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === "object" && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isNonNegativeInteger(value: unknown): value is number {
  return isFiniteNumber(value) && Number.isInteger(value) && value >= 0;
}

function isStringArray(value: unknown): value is string[] {
  return (
    Array.isArray(value) && value.every((item) => typeof item === "string")
  );
}

function isOneOf<const T extends readonly string[]>(
  value: unknown,
  choices: T,
): value is T[number] {
  return (
    typeof value === "string" && choices.some((choice) => choice === value)
  );
}

function isConfidence(value: unknown): boolean {
  return isOneOf(value, ["high", "medium", "low"] as const);
}

function isRepoMetadata(value: unknown): boolean {
  if (!isObject(value)) return false;
  return (
    typeof value.name === "string" &&
    typeof value.url === "string" &&
    typeof value.branch === "string" &&
    (value.clone_hash === null || typeof value.clone_hash === "string") &&
    typeof value.analyzed_at === "string"
  );
}

function isFolderMapNode(value: unknown): boolean {
  const pending: Array<{ value: unknown; depth: number }> = [
    { value, depth: 0 },
  ];
  const seen = new Set<object>();

  while (pending.length > 0) {
    const current = pending.pop();
    if (!current || !isObject(current.value) || seen.has(current.value))
      return false;
    if (current.depth > MAX_FOLDER_VALIDATION_DEPTH) return false;
    seen.add(current.value);

    if (
      typeof current.value.path !== "string" ||
      (current.value.type !== "file" && current.value.type !== "dir")
    ) {
      return false;
    }
    if (
      current.value.truncated != null &&
      typeof current.value.truncated !== "boolean"
    )
      return false;
    if (current.value.children != null) {
      if (!Array.isArray(current.value.children)) return false;
      for (const child of current.value.children) {
        pending.push({ value: child, depth: current.depth + 1 });
      }
    }
  }

  return true;
}

function isStartHereItem(value: unknown): boolean {
  if (!isObject(value)) return false;
  return (
    typeof value.path === "string" &&
    isFiniteNumber(value.score) &&
    typeof value.explanation === "string"
  );
}

function isDangerZoneItem(value: unknown): boolean {
  if (!isObject(value)) return false;
  if (
    typeof value.path !== "string" ||
    !isFiniteNumber(value.score) ||
    typeof value.breakdown !== "string" ||
    !isObject(value.metrics)
  ) {
    return false;
  }
  for (const key of [
    "size",
    "fan_in",
    "fan_out",
    "complexity",
    "test_proximity",
    "churn",
  ] as const) {
    if (value.metrics[key] != null && !isFiniteNumber(value.metrics[key]))
      return false;
  }
  return true;
}

function isRunCommand(value: unknown): boolean {
  if (!isObject(value)) return false;
  return (
    typeof value.source === "string" &&
    typeof value.command === "string" &&
    (value.description == null || typeof value.description === "string")
  );
}

function isContributeSignals(value: unknown): boolean {
  return (
    isObject(value) &&
    isStringArray(value.key_docs) &&
    isStringArray(value.ci_configs)
  );
}

function isArchitectureNode(value: unknown): boolean {
  if (!isObject(value)) return false;
  if (typeof value.id !== "string" || typeof value.label !== "string")
    return false;
  return (
    value.type == null ||
    isOneOf(value.type, ["file", "module", "folder"] as const)
  );
}

function isArchitectureEdge(value: unknown): boolean {
  if (!isObject(value)) return false;
  if (typeof value.from !== "string" || typeof value.to !== "string")
    return false;
  return (
    value.type == null || isOneOf(value.type, ["import", "dependency"] as const)
  );
}

function isEvidenceRef(value: unknown): boolean {
  if (!isObject(value)) return false;
  if (
    typeof value.id !== "string" ||
    !isOneOf(value.kind, EVIDENCE_KINDS) ||
    typeof value.label !== "string"
  ) {
    return false;
  }
  for (const key of ["path", "command", "detail", "snippet"] as const) {
    if (value[key] != null && typeof value[key] !== "string") return false;
  }
  for (const key of ["line_start", "line_end"] as const) {
    if (value[key] != null && !isNonNegativeInteger(value[key])) return false;
  }
  return true;
}

function isBriefAnswer(value: unknown): boolean {
  return (
    isObject(value) &&
    typeof value.answer === "string" &&
    isStringArray(value.bullets) &&
    isStringArray(value.evidence_refs) &&
    isConfidence(value.confidence)
  );
}

function isAnalysisFocus(value: unknown): boolean {
  if (!isObject(value)) return false;
  if (
    !isOneOf(value.intent, [
      "bug",
      "planned_change",
      "pull_request",
    ] as const) ||
    typeof value.label !== "string" ||
    typeof value.summary !== "string" ||
    !Array.isArray(value.review_steps) ||
    !isStringArray(value.discussion_questions)
  ) {
    return false;
  }
  return value.review_steps.every(
    (step) =>
      isObject(step) &&
      typeof step.title === "string" &&
      typeof step.detail === "string" &&
      isStringArray(step.evidence_refs),
  );
}

function isCandidateBrief(value: unknown): boolean {
  if (!isObject(value) || !isObject(value.repo_summary)) return false;
  if (
    typeof value.repo_summary.headline !== "string" ||
    typeof value.repo_summary.plain_english !== "string" ||
    !isStringArray(value.repo_summary.primary_evidence) ||
    !isConfidence(value.repo_summary.confidence)
  ) {
    return false;
  }

  if (
    !Array.isArray(value.reading_path) ||
    !value.reading_path.every(
      (item) =>
        isObject(item) &&
        isNonNegativeInteger(item.order) &&
        typeof item.title === "string" &&
        typeof item.path === "string" &&
        typeof item.why === "string" &&
        isStringArray(item.evidence_refs),
    )
  ) {
    return false;
  }

  if (!isObject(value.interview_talking_points)) return false;
  for (const key of [
    "walk_me_through_codebase",
    "riskiest_areas",
    "tradeoffs",
    "improve_first",
    "first_week_contribution",
  ] as const) {
    if (!isBriefAnswer(value.interview_talking_points[key])) return false;
  }

  if (
    !Array.isArray(value.first_pr_plan) ||
    !value.first_pr_plan.every(
      (item) =>
        isObject(item) &&
        typeof item.title === "string" &&
        typeof item.rationale === "string" &&
        isStringArray(item.suggested_files) &&
        isStringArray(item.evidence_refs) &&
        isOneOf(item.risk, ["low", "medium", "high"] as const),
    )
  ) {
    return false;
  }

  if (
    !Array.isArray(value.resume_bullets) ||
    !value.resume_bullets.every(
      (item) =>
        isObject(item) &&
        isOneOf(item.audience, ["resume", "linkedin"] as const) &&
        typeof item.text === "string" &&
        isStringArray(item.evidence_refs),
    ) ||
    !Array.isArray(value.evidence_refs) ||
    !value.evidence_refs.every(isEvidenceRef) ||
    !Array.isArray(value.warnings) ||
    !value.warnings.every(
      (warning) =>
        isObject(warning) &&
        typeof warning.message === "string" &&
        (warning.evidence_refs == null || isStringArray(warning.evidence_refs)),
    )
  ) {
    return false;
  }

  if (value.analysis_focus != null && !isAnalysisFocus(value.analysis_focus))
    return false;
  if (value.confidence_assessment != null) {
    const assessment = value.confidence_assessment;
    if (
      !isObject(assessment) ||
      !isConfidence(assessment.level) ||
      !isStringArray(assessment.reasons) ||
      !isStringArray(assessment.gaps)
    ) {
      return false;
    }
  }
  if (value.walkthrough_script != null) {
    const script = value.walkthrough_script;
    if (
      !isObject(script) ||
      typeof script.thirty_second !== "string" ||
      typeof script.two_minute !== "string" ||
      typeof script.deep_technical !== "string" ||
      !isStringArray(script.tradeoffs_to_mention) ||
      !isStringArray(script.improvements_next) ||
      !isStringArray(script.evidence_refs)
    ) {
      return false;
    }
  }
  if (
    value.behavioral_hooks != null &&
    (!Array.isArray(value.behavioral_hooks) ||
      !value.behavioral_hooks.every(
        (hook) =>
          isObject(hook) &&
          typeof hook.prompt === "string" &&
          typeof hook.answer_starter === "string" &&
          isStringArray(hook.evidence_refs) &&
          typeof hook.sufficient_evidence === "boolean",
      ))
  ) {
    return false;
  }
  if (
    value.interview_questions != null &&
    (!Array.isArray(value.interview_questions) ||
      !value.interview_questions.every(
        (question) =>
          isObject(question) &&
          typeof question.question === "string" &&
          typeof question.rationale === "string" &&
          isStringArray(question.evidence_refs) &&
          (question.generic == null || typeof question.generic === "boolean"),
      ))
  ) {
    return false;
  }

  return true;
}

function isCommitInsights(value: unknown): boolean {
  if (!isObject(value)) return false;
  if (!isOneOf(value.mode, ["local_git", "github_api", "unavailable"] as const))
    return false;
  return (
    isStringArray(value.recent_work_areas) &&
    isStringArray(value.high_churn_files) &&
    Array.isArray(value.co_changed_pairs) &&
    value.co_changed_pairs.every(
      (pair) =>
        isObject(pair) &&
        Array.isArray(pair.files) &&
        pair.files.length === 2 &&
        pair.files.every((file) => typeof file === "string") &&
        isNonNegativeInteger(pair.count),
    ) &&
    isStringArray(value.evidence_refs)
  );
}

function isSemanticGraph(value: unknown): boolean {
  if (!isObject(value) || !isNonNegativeInteger(value.version)) return false;
  if (typeof value.language !== "string" || typeof value.adapter !== "string")
    return false;
  if (!Array.isArray(value.nodes) || !Array.isArray(value.edges)) return false;
  if (!isObject(value.stats) || !isStringArray(value.warnings)) return false;
  if (
    !value.nodes.every(
      (node) =>
        isObject(node) &&
        typeof node.id === "string" &&
        isOneOf(node.kind, SEMANTIC_NODE_KINDS) &&
        typeof node.label === "string" &&
        (node.language == null || typeof node.language === "string") &&
        (node.entrypoint_reason == null ||
          typeof node.entrypoint_reason === "string"),
    )
  ) {
    return false;
  }
  for (const key of [
    "node_count",
    "edge_count",
    "resolved_internal",
    "resolved_external",
    "unresolved",
    "ignored",
    "entrypoint_count",
  ] as const) {
    if (!isNonNegativeInteger(value.stats[key])) return false;
  }
  for (const edge of value.edges) {
    if (!isObject(edge)) return false;
    if (
      typeof edge.id !== "string" ||
      typeof edge.from !== "string" ||
      (edge.to != null && typeof edge.to !== "string") ||
      typeof edge.specifier !== "string" ||
      !isOneOf(edge.kind, SEMANTIC_EDGE_KINDS) ||
      !isOneOf(edge.resolution, RESOLUTION_STATUSES) ||
      !isObject(edge.evidence) ||
      typeof edge.evidence.path !== "string" ||
      !isNonNegativeInteger(edge.evidence.line_start) ||
      !isNonNegativeInteger(edge.evidence.line_end) ||
      (edge.evidence.snippet != null &&
        typeof edge.evidence.snippet !== "string") ||
      (edge.reason != null && typeof edge.reason !== "string") ||
      (edge.type_only != null && typeof edge.type_only !== "boolean")
    ) {
      return false;
    }
  }
  return true;
}

/** Validate parsed JSON as a supported Report. */
export function validateReport(data: unknown): ReportLoadResult {
  if (!isObject(data)) return { ok: false, reason: "corrupt" };

  const version = data.report_version;
  if (version != null) {
    if (!isNonNegativeInteger(version) || version === 0) {
      return { ok: false, reason: "corrupt" };
    }
    if (version > REPORT_VERSION) return { ok: false, reason: "incompatible" };
  }
  if (
    data.analysis_intent != null &&
    !ANALYSIS_INTENTS.some((intent) => intent === data.analysis_intent)
  ) {
    return { ok: false, reason: "corrupt" };
  }

  if (!isRepoMetadata(data.repo_metadata))
    return { ok: false, reason: "corrupt" };
  if (!isFolderMapNode(data.folder_map))
    return { ok: false, reason: "corrupt" };

  if (
    !Array.isArray(data.start_here) ||
    !data.start_here.every(isStartHereItem)
  ) {
    return { ok: false, reason: "corrupt" };
  }
  if (
    !Array.isArray(data.danger_zones) ||
    !data.danger_zones.every(isDangerZoneItem)
  ) {
    return { ok: false, reason: "corrupt" };
  }
  if (
    !Array.isArray(data.run_commands) ||
    !data.run_commands.every(isRunCommand)
  ) {
    return { ok: false, reason: "corrupt" };
  }
  if (!isContributeSignals(data.contribute_signals))
    return { ok: false, reason: "corrupt" };
  if (!isStringArray(data.warnings)) return { ok: false, reason: "corrupt" };

  if (!isObject(data.architecture)) return { ok: false, reason: "corrupt" };
  if (
    !Array.isArray(data.architecture.nodes) ||
    !data.architecture.nodes.every(isArchitectureNode) ||
    !Array.isArray(data.architecture.edges) ||
    !data.architecture.edges.every(isArchitectureEdge)
  ) {
    return { ok: false, reason: "corrupt" };
  }

  if (data.candidate_brief != null && !isCandidateBrief(data.candidate_brief)) {
    return { ok: false, reason: "corrupt" };
  }
  if (data.commit_insights != null && !isCommitInsights(data.commit_insights)) {
    return { ok: false, reason: "corrupt" };
  }
  if (data.semantic_graph != null && !isSemanticGraph(data.semantic_graph)) {
    return { ok: false, reason: "corrupt" };
  }
  if (data.partial != null && typeof data.partial !== "boolean") {
    return { ok: false, reason: "corrupt" };
  }

  return { ok: true, report: data as unknown as Report };
}

export function parseAndValidateReport(text: string): ReportLoadResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { ok: false, reason: "corrupt" };
  }
  return validateReport(parsed);
}
