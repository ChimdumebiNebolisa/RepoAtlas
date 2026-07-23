import { describe, expect, it } from "vitest";
import type {
  ArchitectureInsights,
  DangerZoneItem,
  ProjectProfile,
  TestInventory,
} from "@/types/report";
import {
  generateInterviewQuestions,
  type QuestionGeneratorInput,
} from "./questions";

const profile: ProjectProfile = {
  type: "nextjs-app",
  label: "Next.js application",
  confidence: "high",
  signals: ["src/app/**/page.tsx"],
  evidence_refs: ["profile-1"],
};

const dangerZone: DangerZoneItem = {
  path: "src/app/page.tsx",
  score: 84,
  breakdown: "size 20 + fan-out 24 + test proximity 40",
  metrics: { size: 20, fan_out: 24, test_proximity: 40 },
};

const testInventory: TestInventory = {
  test_file_count: 2,
  frameworks: ["Vitest"],
  tested_areas: ["src/lib/parser.ts"],
  untested_high_risk_files: [dangerZone.path],
  suggested_test_targets: [dangerZone.path],
  evidence_refs: [],
};

const architectureInsights: ArchitectureInsights = {
  layers: ["app", "lib"],
  violations: [
    {
      from: "src/app/page.tsx",
      to: "src/lib/server.ts",
      reason: "Import from lib into app may cross layer boundaries",
    },
  ],
  circular_deps: [],
  hubs: [],
};

function generate(overrides: Partial<QuestionGeneratorInput> = {}) {
  return generateInterviewQuestions({
    projectProfile: profile,
    dangerZones: [dangerZone],
    dangerZoneEvidenceRefs: { [dangerZone.path]: "risk-1" },
    testInventory,
    architectureInsights,
    architectureEvidenceRef: "arch-1",
    ...overrides,
  });
}

describe("generateInterviewQuestions", () => {
  it("builds the complete ordered set with direct evidence", () => {
    expect(generate()).toEqual([
      {
        question: "Why does this appear to be a Next.js application?",
        rationale: "Project type is derived from detected files and dependencies.",
        evidence_refs: ["profile-1"],
      },
      {
        question: "What makes `src/app/page.tsx` a danger zone in this codebase?",
        rationale: "Top risk-ranked file with measurable breakdown.",
        evidence_refs: ["risk-1"],
      },
      {
        question: "What tests would you add near `src/app/page.tsx`?",
        rationale:
          "High-risk file with low test proximity (a static signal, not measured coverage).",
        evidence_refs: ["risk-1"],
      },
      {
        question: "What are the limits of static analysis for this repository?",
        rationale: "Warnings and missing git history bound confidence.",
        evidence_refs: [],
        generic: true,
      },
      {
        question:
          "Why might importing from `src/lib/server.ts` into `src/app/page.tsx` be worth discussing?",
        rationale: "Import from lib into app may cross layer boundaries",
        evidence_refs: ["arch-1"],
      },
    ]);
  });

  it("returns only the generic fallback for sparse input", () => {
    expect(generateInterviewQuestions({ dangerZones: [] })).toEqual([
      {
        question: "What are the limits of static analysis for this repository?",
        rationale: "Warnings and missing git history bound confidence.",
        evidence_refs: [],
        generic: true,
      },
    ]);
  });

  it("does not require a project profile", () => {
    const questions = generate({ projectProfile: undefined });

    expect(questions).toHaveLength(4);
    expect(questions[0]?.question).toContain("danger zone");
  });

  it("omits a project-specific classification prompt without direct evidence", () => {
    const questions = generate({
      projectProfile: { ...profile, evidence_refs: [] },
    });

    expect(questions.some((item) => item.question.startsWith("Why does this appear"))).toBe(false);
  });

  it("links the top danger-zone prompt to its exact evidence", () => {
    const questions = generate({
      dangerZones: [
        dangerZone,
        { ...dangerZone, path: "src/lib/other.ts", score: 80 },
      ],
    });

    expect(questions.filter((item) => item.question.includes("danger zone"))).toEqual([
      expect.objectContaining({
        question: expect.stringContaining(dangerZone.path),
        evidence_refs: ["risk-1"],
      }),
    ]);
  });

  it("omits a danger-zone prompt when the file has no evidence reference", () => {
    const questions = generate({ dangerZoneEvidenceRefs: {} });

    expect(questions.some((item) => item.question.includes("danger zone"))).toBe(false);
  });

  it("links an untested high-risk prompt to the corresponding risk evidence", () => {
    const question = generate().find((item) => item.question.startsWith("What tests"));

    expect(question).toEqual({
      question: "What tests would you add near `src/app/page.tsx`?",
      rationale:
        "High-risk file with low test proximity (a static signal, not measured coverage).",
      evidence_refs: ["risk-1"],
    });
  });

  it("omits an untested high-risk prompt when its target has no direct evidence", () => {
    const questions = generate({ dangerZoneEvidenceRefs: {} });

    expect(questions.some((item) => item.question.startsWith("What tests"))).toBe(false);
  });

  it("keeps the architecture direction and rationale tied to architecture evidence", () => {
    const question = generate().find((item) => item.question.startsWith("Why might importing"));

    expect(question).toEqual({
      question:
        "Why might importing from `src/lib/server.ts` into `src/app/page.tsx` be worth discussing?",
      rationale: architectureInsights.violations[0]?.reason,
      evidence_refs: ["arch-1"],
    });
  });

  it("omits an architecture-specific prompt without architecture evidence", () => {
    const questions = generate({ architectureEvidenceRef: undefined });

    expect(questions.some((item) => item.question.startsWith("Why might importing"))).toBe(false);
  });

  it("keeps the generic fallback after repository risk prompts and before architecture", () => {
    expect(generate().map((item) => item.question)).toEqual([
      expect.stringMatching(/^Why does this appear/),
      expect.stringMatching(/danger zone/),
      expect.stringMatching(/^What tests/),
      "What are the limits of static analysis for this repository?",
      expect.stringMatching(/^Why might importing/),
    ]);
  });

  it("does not assert defects, runtime behavior, intent, or measured test coverage", () => {
    const serialized = JSON.stringify(generate()).toLowerCase();

    expect(serialized).not.toContain("has bugs");
    expect(serialized).not.toContain("vulnerability");
    expect(serialized).not.toContain("runtime behavior");
    expect(serialized).not.toContain("maintainer intent");
    expect(serialized).toContain("not measured coverage");
  });

  it("never exceeds the ten-question cap for oversized source arrays", () => {
    const manyDangerZones = Array.from({ length: 20 }, (_, index) => ({
      ...dangerZone,
      path: `src/feature-${index}.ts`,
      score: 100 - index,
    }));
    const refs = Object.fromEntries(
      manyDangerZones.map((item, index) => [item.path, `risk-${index + 1}`])
    );

    const questions = generate({
      dangerZones: manyDangerZones,
      dangerZoneEvidenceRefs: refs,
    });

    expect(questions).toHaveLength(4);
    expect(questions.length).toBeLessThanOrEqual(10);
    expect(questions.filter((item) => item.question.includes("danger zone"))).toHaveLength(1);
  });
});
