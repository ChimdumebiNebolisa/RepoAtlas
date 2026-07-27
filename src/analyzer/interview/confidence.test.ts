import { describe, expect, it } from "vitest";
import type { BuildCandidateBriefInput } from "./types";
import { buildConfidenceAssessment } from "./evidence";

function makeInput(
  overrides: Partial<BuildCandidateBriefInput> = {}
): BuildCandidateBriefInput {
  return {
    repoName: "confidence-fixture",
    startHere: [
      {
        path: "README.md",
        score: 90,
        explanation: "Root documentation",
      },
    ],
    dangerZones: [],
    runCommands: [{ source: "package.json", command: "npm test" }],
    contributeSignals: {
      key_docs: ["README.md"],
      ci_configs: [".github/workflows/ci.yml"],
    },
    architecture: {
      nodes: [{ id: "src", label: "src", type: "folder" }],
      edges: [{ from: "src", to: "lib", type: "import" }],
    },
    testInventory: {
      frameworks: ["vitest"],
      test_file_count: 1,
      tested_areas: ["src/confidence.test.ts"],
      untested_high_risk_files: [],
      suggested_test_targets: [],
      evidence_refs: [],
    },
    projectPurpose: {
      text: "Evidence-backed repository walkthroughs.",
      source: "readme_intro",
      path: "README.md",
      extracted: true,
      evidence_refs: [],
    },
    warnings: [],
    ...overrides,
  };
}

describe("Candidate Brief confidence warnings", () => {
  it.each([
    [1, "high", []],
    [2, "medium", ["Multiple analysis warnings"]],
    [3, "medium", ["Multiple analysis warnings"]],
    [4, "medium", ["Multiple analysis warnings"]],
  ] as const)(
    "sets complete-report confidence honestly with %i material warning(s)",
    (warningCount, expectedLevel, expectedWarningGaps) => {
      const assessment = buildConfidenceAssessment(
        makeInput({
          warnings: Array.from(
            { length: warningCount },
            (_, index) => `Analysis warning ${index + 1}.`
          ),
        })
      );

      expect(assessment.level).toBe(expectedLevel);
      expect(
        assessment.gaps.filter((gap) => gap.includes("analysis warning"))
      ).toEqual(expectedWarningGaps);
    }
  );

  it.each([
    [1, ["Analysis stopped before completion"]],
    [
      2,
      ["Analysis stopped before completion", "Multiple analysis warnings"],
    ],
    [
      3,
      ["Analysis stopped before completion", "Multiple analysis warnings"],
    ],
    [
      4,
      ["Analysis stopped before completion", "Multiple analysis warnings"],
    ],
  ] as const)(
    "keeps a partial report below high confidence with %i material warning(s)",
    (warningCount, expectedGaps) => {
      const assessment = buildConfidenceAssessment(
        makeInput({
          partial: true,
          warnings: Array.from(
            { length: warningCount },
            (_, index) => `Analysis warning ${index + 1}.`
          ),
        })
      );

      expect(assessment.level).toBe("medium");
      expect(assessment.gaps).toEqual(expectedGaps);
    }
  );

  it("keeps expected ZIP and architecture summaries informational", () => {
    const assessment = buildConfidenceAssessment(
      makeInput({
        warnings: [
          "Architecture reduced from file-level (12 files) to folder-level (8 folders).",
          "Architecture reduced from file-level (6 files) to package-level (4 packages).",
          "Commit history unavailable for zip uploads without .git metadata.",
        ],
      })
    );

    expect(assessment.level).toBe("high");
    expect(assessment.gaps).not.toContain("Multiple analysis warnings");
  });
});
