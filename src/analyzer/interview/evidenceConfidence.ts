import type { ConfidenceAssessment } from "@/types/report";
import type { BuildCandidateBriefInput, Confidence } from "./types";

const INFORMATIONAL_WARNING_PATTERNS = [
  /^Architecture reduced from file-level \(\d+ files\) to (?:folder|package)-level \(\d+ (?:folders|packages)\)\.$/,
  /^Commit history unavailable for zip uploads without \.git metadata\.$/,
];

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
