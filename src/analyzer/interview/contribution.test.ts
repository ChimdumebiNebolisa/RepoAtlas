import { describe, expect, it } from "vitest";
import type { BuildCandidateBriefInput, EvidenceIndex } from "./types";
import { buildEvidenceIndex } from "./evidence";
import {
  buildFirstPrPlan,
  buildFirstWeekAnswer,
  buildImproveFirstAnswer,
} from "./contribution";

const baseInput: BuildCandidateBriefInput = {
  repoName: "contribution-fixture",
  startHere: [
    {
      path: "README.md",
      score: 100,
      explanation: "Root documentation",
    },
  ],
  dangerZones: [
    {
      path: "src/risky.ts",
      score: 82,
      breakdown: "size and low test proximity",
      metrics: {
        size: 900,
        fan_in: 3,
        fan_out: 5,
        complexity: 12,
        test_proximity: 0,
      },
    },
  ],
  runCommands: [
    {
      source: "package.json",
      command: "npm test",
      description: "test",
    },
  ],
  contributeSignals: {
    key_docs: ["README.md"],
    ci_configs: [".github/workflows/ci.yml"],
  },
  architecture: {
    nodes: [{ id: "src", label: "src", type: "folder" }],
    edges: [],
  },
  warnings: [],
};

function inputWith(
  overrides: Partial<BuildCandidateBriefInput> = {}
): BuildCandidateBriefInput {
  return {
    ...baseInput,
    ...overrides,
  };
}

function evidenceFor(input: BuildCandidateBriefInput): EvidenceIndex {
  return buildEvidenceIndex(input);
}

describe("first-contribution guidance boundary", () => {
  it("orders and limits complete guidance while keeping direct evidence", () => {
    const input = inputWith();
    const evidence = evidenceFor(input);
    const plan = buildFirstPrPlan(input, evidence);

    expect(plan.map((idea) => idea.title)).toEqual([
      "Verify and document the detected run commands",
      "Add or expand contributor guidance",
      "Add tests near src/risky.ts",
    ]);
    expect(plan).toHaveLength(3);
    expect(plan[2]).toMatchObject({
      suggested_files: ["src/risky.ts"],
      evidence_refs: [evidence.dangerZoneRefs.get("src/risky.ts")],
      risk: "medium",
    });
    expect(new Set(plan.map((idea) => idea.title)).size).toBe(plan.length);
  });

  it("uses bounded fallbacks when commands, docs, tests, and CI are absent", () => {
    const input = inputWith({
      startHere: [],
      dangerZones: [],
      runCommands: [],
      contributeSignals: { key_docs: [], ci_configs: [] },
      warnings: [],
    });
    const evidence = evidenceFor(input);
    const plan = buildFirstPrPlan(input, evidence);

    expect(plan.map((idea) => idea.title)).toEqual([
      "Document the local run workflow",
      "Add or expand contributor guidance",
      "Document or add validation checks",
    ]);
    expect(plan.every((idea) => idea.suggested_files.length === 0)).toBe(true);
    expect(plan.every((idea) => idea.evidence_refs.length > 0)).toBe(true);
    expect(plan[1].evidence_refs).toEqual([evidence.architectureRef]);
  });

  it("maps a risk-ranked file without claiming missing test proximity", () => {
    const input = inputWith({
      dangerZones: [
        {
          ...baseInput.dangerZones[0],
          score: 60,
          metrics: {
            ...baseInput.dangerZones[0].metrics,
            test_proximity: undefined,
          },
        },
      ],
    });
    const evidence = evidenceFor(input);
    const plan = buildFirstPrPlan(input, evidence);

    expect(plan[2]).toMatchObject({
      title: "Map behavior around src/risky.ts",
      risk: "low",
      evidence_refs: [evidence.dangerZoneRefs.get("src/risky.ts")],
    });
  });

  it("keeps the low-risk test branch distinct from the high-risk branch", () => {
    const input = inputWith({
      dangerZones: [
        {
          ...baseInput.dangerZones[0],
          score: 60,
        },
      ],
    });
    const plan = buildFirstPrPlan(input, evidenceFor(input));

    expect(plan[2]).toMatchObject({
      title: "Add tests near src/risky.ts",
      risk: "low",
    });
  });

  it("suggests only canonical documents that have inspectable evidence", () => {
    const input = inputWith({
      dangerZones: [],
      contributeSignals: {
        key_docs: [
          "packages/api/README.md",
          "README.md",
          "CONTRIBUTING.md",
        ],
        ci_configs: [".github/workflows/ci.yml"],
      },
      documentInventory: {
        documents: [
          {
            path: "README.md",
            category: "readme",
            scope: "root",
            bytes: 40,
            content_hash: "readme",
            normalized_hash: "same-readme",
            canonical: true,
          },
          {
            path: "packages/api/README.md",
            category: "readme",
            scope: "nested",
            bytes: 40,
            content_hash: "readme",
            normalized_hash: "same-readme",
            canonical: false,
            duplicate_of: "README.md",
          },
          {
            path: "CONTRIBUTING.md",
            category: "contributing",
            scope: "root",
            bytes: 50,
            content_hash: "contributing",
            normalized_hash: "contributing",
            canonical: true,
          },
        ],
        duplicate_groups: [
          {
            canonical: "README.md",
            duplicates: ["packages/api/README.md"],
            reason: "identical",
          },
        ],
      },
    });
    const evidence = evidenceFor(input);
    const evidencePaths = new Set(
      evidence.refs
        .map((ref) => ref.path)
        .filter((path): path is string => Boolean(path))
    );
    const plan = buildFirstPrPlan(input, evidence);

    expect(plan[0].suggested_files).toEqual([
      "README.md",
      "CONTRIBUTING.md",
    ]);
    expect(
      plan.flatMap((idea) => idea.suggested_files).every((path) =>
        evidencePaths.has(path)
      )
    ).toBe(true);
    expect(
      plan.flatMap((idea) => idea.suggested_files)
    ).not.toContain("packages/api/README.md");
  });

  it("uses CI and warning evidence when contribution docs already exist", () => {
    const input = inputWith({
      dangerZones: [],
      contributeSignals: {
        key_docs: ["README.md", "CONTRIBUTING.md"],
        ci_configs: [".github/workflows/ci.yml"],
      },
      warnings: ["Deep analysis was unavailable."],
    });
    const evidence = evidenceFor(input);
    const plan = buildFirstPrPlan(input, evidence);

    expect(plan.map((idea) => idea.title)).toEqual([
      "Verify and document the detected run commands",
      "Align contributor docs with CI validation",
      "Clarify analysis gaps in project docs",
    ]);
    expect(plan[1].suggested_files).toEqual([
      "README.md",
      "CONTRIBUTING.md",
      ".github/workflows/ci.yml",
    ]);
    expect(plan[1].evidence_refs).toContain(
      evidence.ciRefs.get(".github/workflows/ci.yml")
    );
    expect(plan[2].evidence_refs).toContain(evidence.warningRefs[0]);
  });

  it("does not name a risk-ranked file when its direct evidence is missing", () => {
    const input = inputWith();
    const evidence = evidenceFor(input);
    evidence.dangerZoneRefs.clear();
    const plan = buildFirstPrPlan(input, evidence);

    expect(plan.map((idea) => idea.title)).toEqual([
      "Verify and document the detected run commands",
      "Add or expand contributor guidance",
      "Align contributor docs with CI validation",
    ]);
    expect(
      plan.flatMap((idea) => idea.suggested_files)
    ).not.toContain("src/risky.ts");
  });

  it("deduplicates answer evidence and lowers confidence for sparse plans", () => {
    const complete = buildImproveFirstAnswer([
      {
        title: "First",
        rationale: "One",
        suggested_files: [],
        evidence_refs: ["doc-1", "shared"],
        risk: "low",
      },
      {
        title: "Second",
        rationale: "Two",
        suggested_files: [],
        evidence_refs: ["shared"],
        risk: "low",
      },
      {
        title: "Third",
        rationale: "Three",
        suggested_files: [],
        evidence_refs: ["risk-1"],
        risk: "medium",
      },
    ]);
    const sparse = buildImproveFirstAnswer([]);

    expect(complete.evidence_refs).toEqual(["doc-1", "shared", "risk-1"]);
    expect(complete.confidence).toBe("medium");
    expect(sparse).toMatchObject({
      bullets: [],
      evidence_refs: [],
      confidence: "low",
    });
  });

  it("builds complete and sparse first-week sequences without inventing files", () => {
    const completeInput = inputWith({
      runCommands: [
        ...baseInput.runCommands,
        {
          source: "package.json",
          command: "npm run build",
          description: "build",
        },
        {
          source: "package.json",
          command: "npm run lint",
          description: "lint",
        },
      ],
    });
    const completeEvidence = evidenceFor(completeInput);
    const completePlan = buildFirstPrPlan(completeInput, completeEvidence);
    const complete = buildFirstWeekAnswer(
      completeInput,
      completeEvidence,
      completePlan
    );

    const sparseInput = inputWith({
      startHere: [],
      dangerZones: [],
      runCommands: [],
      contributeSignals: { key_docs: [], ci_configs: [] },
      warnings: ["Only basic analysis was available."],
    });
    const sparse = buildFirstWeekAnswer(
      sparseInput,
      evidenceFor(sparseInput),
      []
    );

    expect(complete.bullets).toEqual([
      "Day 1: read `README.md` and the next ranked files.",
      "Validate the detected command path: `npm test`, `npm run build`.",
      "Review the top risk-ranked file: `src/risky.ts`.",
      "Open with a scoped PR idea: Verify and document the detected run commands.",
    ]);
    expect(sparse.bullets).toEqual([
      "Day 1: inspect the folder map and any available docs.",
      "Identify and document the expected local run or test command.",
      "Use warnings to understand where deep analysis was unavailable.",
      "Keep the first PR small and evidence-backed.",
    ]);
  });
});
