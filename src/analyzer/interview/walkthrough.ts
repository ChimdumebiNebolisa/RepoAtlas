import type { BehavioralHook, WalkthroughScript } from "@/types/report";
import {
  decisionsWithDirectEvidence,
  listPaths,
  refValues,
} from "./evidence";
import type { BuildCandidateBriefInput, EvidenceIndex } from "./types";

const WALKTHROUGH_PURPOSE_LIMIT = 80;

interface TextRange {
  start: number;
  end: number;
}

function finishSentence(value: string): string {
  const trimmed = value.trimEnd();
  return /[.!?…]$/.test(trimmed) ? `${trimmed} ` : `${trimmed}. `;
}

function collectMatches(value: string, pattern: RegExp): TextRange[] {
  return Array.from(value.matchAll(pattern), (match) => ({
    start: match.index,
    end: match.index + match[0].length,
  }));
}

function inlineMarkdownRanges(value: string): TextRange[] {
  return [
    ...collectMatches(value, /!?\[[^\]\n]+\]\([^\)\n]+\)/g),
    ...collectMatches(value, /(`+)(?=\S)([^\n]*?\S)\1/g),
    ...collectMatches(value, /\*\*(?=\S)([^\n]*?\S)\*\*/g),
    ...collectMatches(value, /__(?=\S)([^\n]*?\S)__/g),
  ];
}

function graphemeSafeEnd(value: string, codePointLimit: number): number {
  const segmenter = new Intl.Segmenter(undefined, {
    granularity: "grapheme",
  });
  let codePoints = 0;
  let end = 0;

  for (const segment of segmenter.segment(value)) {
    const nextCount = codePoints + Array.from(segment.segment).length;
    if (nextCount > codePointLimit) break;
    codePoints = nextCount;
    end = segment.index + segment.segment.length;
  }

  return end;
}

function concisePurpose(value: string): string {
  const normalized = value.trim().replace(/\s+/g, " ");
  const characters = Array.from(normalized);
  if (characters.length <= WALKTHROUGH_PURPOSE_LIMIT) return normalized;

  const graphemeEnd = graphemeSafeEnd(
    normalized,
    WALKTHROUGH_PURPOSE_LIMIT
  );
  const markdownStart = inlineMarkdownRanges(normalized)
    .filter((range) => range.start < graphemeEnd && range.end > graphemeEnd)
    .reduce<number | undefined>(
      (earliest, range) =>
        earliest === undefined ? range.start : Math.min(earliest, range.start),
      undefined
    );
  if (markdownStart !== undefined) {
    const beforeMarkdown = normalized.slice(0, markdownStart).trimEnd();
    return beforeMarkdown ? `${beforeMarkdown}…` : "…";
  }

  const clipped = normalized.slice(0, graphemeEnd);
  const trimmedClipped = clipped.trimEnd();
  if (/[.!?…]$/.test(trimmedClipped)) return trimmedClipped;

  const lastWhitespace = clipped.lastIndexOf(" ");
  if (lastWhitespace <= 0) return "";
  return `${clipped.slice(0, lastWhitespace)}…`;
}

export function buildWalkthroughScript(
  input: BuildCandidateBriefInput,
  evidence: EvidenceIndex
): WalkthroughScript | undefined {
  const profile = input.projectProfile?.label ?? "this codebase";
  const purpose = input.projectPurpose?.text;
  const purposeExcerpt = purpose ? concisePurpose(purpose) : "";
  const topPaths = input.startHere.slice(0, 3).map((item) => item.path);
  const commands = input.runCommands.slice(0, 2).map((item) => item.command);
  const symbolNames = (input.symbols ?? [])
    .slice(0, 5)
    .map((symbol) => symbol.name);

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
    finishSentence(`${profile}${purposeExcerpt ? `: ${purposeExcerpt}` : ""}`) +
    `Start at ${topPaths[0] ?? "the folder map"}, validate with ${commands[0] ?? "detected project files"}.`;

  const two_minute =
    `${thirty_second} Review ${listPaths(topPaths, "ranked files")}, ` +
    `then discuss architecture (${input.architecture.nodes.length} nodes) and top risk file ` +
    `${input.dangerZones[0]?.path ?? "if present"}.`;

  const deep =
    two_minute +
    (symbolNames.length ? ` Key surfaces include ${symbolNames.join(", ")}.` : "");

  const evidencedDecisions = decisionsWithDirectEvidence(input, evidence).slice(
    0,
    3
  );
  const tradeoffs = evidencedDecisions.map((decision) => decision.decision);
  const improvements = input.dangerZones
    .slice(0, 2)
    .map((zone) => `Review test proximity and complexity around ${zone.path}`);

  return {
    thirty_second,
    two_minute,
    deep_technical: deep,
    tradeoffs_to_mention: tradeoffs,
    improvements_next:
      improvements.length > 0
        ? improvements
        : ["Clarify run/test workflow in docs."],
    evidence_refs: [
      ...refValues(evidence.startHereRefs, 2),
      evidence.architectureRef,
      ...refValues(evidence.commandRefs, 1),
      ...evidencedDecisions.flatMap((decision) => decision.evidence_refs),
    ],
  };
}

export function buildBehavioralHooks(
  input: BuildCandidateBriefInput,
  evidence: EvidenceIndex
): BehavioralHook[] {
  const hooks: BehavioralHook[] = [];

  if (input.dangerZones[0] && (input.testInventory?.test_file_count ?? 0) > 0) {
    hooks.push({
      prompt: "Challenge (STAR template)",
      answer_starter: `Discuss how complexity in \`${input.dangerZones[0].path}\` is managed while tests exist nearby.`,
      evidence_refs: [
        evidence.dangerZoneRefs.get(input.dangerZones[0].path) ??
          evidence.architectureRef,
      ],
      sufficient_evidence: true,
    });
  } else {
    hooks.push({
      prompt: "Challenge (STAR template)",
      answer_starter:
        "Not enough evidence — use a different example or skip this prompt.",
      evidence_refs: [],
      sufficient_evidence: false,
    });
  }

  const decisions = decisionsWithDirectEvidence(input, evidence);
  if (decisions.length >= 2) {
    const displayedDecisions = decisions.slice(0, 3);
    const decisionRefs = displayedDecisions
      .flatMap((decision) => decision.evidence_refs)
      .slice(0, 4);
    hooks.push({
      prompt: "Tradeoff (STAR template)",
      answer_starter: `Use ${displayedDecisions.map((decision) => decision.decision).join(" and ")} as directly evidenced technical choices. Separate what the files prove from questions about rationale, alternatives, and runtime effects.`,
      evidence_refs: decisionRefs,
      sufficient_evidence: true,
    });
  } else {
    hooks.push({
      prompt: "Tradeoff (STAR template)",
      answer_starter:
        "Not enough evidence — use a different example or skip this prompt.",
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
