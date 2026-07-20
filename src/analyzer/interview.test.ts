import { describe, expect, it } from "vitest";
import { buildCandidateBrief } from "./interview";
import type { CandidateBrief } from "@/types/report";

const baseInput = {
  repoName: "example-repo",
  startHere: [
    {
      path: "README.md",
      score: 100,
      explanation: "root README documentation",
    },
    {
      path: "src/app/page.tsx",
      score: 86,
      explanation: "Next.js page entry; detected entrypoint",
    },
  ],
  dangerZones: [
    {
      path: "src/lib/risky.ts",
      score: 82,
      breakdown:
        "size p90 (bytes=900), fan-in p80 (4), fan-out p70 (5), complexity p95 (20), test proximity 0, no nearby tests",
      metrics: {
        size: 900,
        fan_in: 4,
        fan_out: 5,
        complexity: 20,
        test_proximity: 0,
      },
    },
  ],
  runCommands: [
    {
      source: "package.json",
      command: "npm run test",
      description: "test",
    },
  ],
  contributeSignals: {
    key_docs: ["README.md"],
    ci_configs: [".github/workflows/ci.yml"],
  },
  architecture: {
    nodes: [
      { id: "src/app", label: "src/app", type: "folder" as const },
      { id: "src/lib", label: "src/lib", type: "folder" as const },
    ],
    edges: [{ from: "src/app", to: "src/lib", type: "import" as const }],
  },
  warnings: ["Deep Python analysis unavailable: no Python source files detected."],
};

function collectReferencedIds(brief: CandidateBrief): string[] {
  return [
    ...brief.repo_summary.primary_evidence,
    ...brief.reading_path.flatMap((item) => item.evidence_refs),
    ...Object.values(brief.interview_talking_points).flatMap((answer) => answer.evidence_refs),
    ...brief.first_pr_plan.flatMap((idea) => idea.evidence_refs),
    ...brief.resume_bullets.flatMap((bullet) => bullet.evidence_refs),
    ...brief.warnings.flatMap((warning) => warning.evidence_refs ?? []),
    ...(brief.walkthrough_script?.evidence_refs ?? []),
    ...(brief.behavioral_hooks?.flatMap((hook) => hook.evidence_refs) ?? []),
    ...(brief.analysis_focus?.review_steps.flatMap((step) => step.evidence_refs) ?? []),
  ];
}

describe("buildCandidateBrief", () => {
  it("returns all Candidate Brief sections", () => {
    const brief = buildCandidateBrief(baseInput);

    expect(brief.repo_summary).toBeDefined();
    expect(brief.reading_path.length).toBeGreaterThan(0);
    expect(brief.interview_talking_points.walk_me_through_codebase).toBeDefined();
    expect(brief.interview_talking_points.riskiest_areas).toBeDefined();
    expect(brief.interview_talking_points.improve_first).toBeDefined();
    expect(brief.interview_talking_points.first_week_contribution).toBeDefined();
    expect(brief.first_pr_plan.length).toBeGreaterThan(0);
    expect(brief.first_pr_plan.length).toBeLessThanOrEqual(3);
    expect(brief.resume_bullets.length).toBeGreaterThan(0);
    expect(brief.evidence_refs.length).toBeGreaterThan(0);
    expect(brief.warnings.length).toBeGreaterThan(0);
  });

  it("builds reading_path from start_here evidence", () => {
    const brief = buildCandidateBrief(baseInput);
    const readmeStep = brief.reading_path[0];
    const readmeEvidence = brief.evidence_refs.find((ref) => ref.path === "README.md");

    expect(readmeStep.path).toBe("README.md");
    expect(readmeStep.why).toContain("root README documentation");
    expect(readmeEvidence?.kind).toBe("start_here");
    expect(readmeStep.evidence_refs).toContain(readmeEvidence?.id);
  });

  it("builds riskiest_areas from danger_zones evidence", () => {
    const brief = buildCandidateBrief(baseInput);
    const riskAnswer = brief.interview_talking_points.riskiest_areas;
    const riskEvidence = brief.evidence_refs.find((ref) => ref.path === "src/lib/risky.ts");

    expect(riskAnswer.answer).toContain("top danger-zone files");
    expect(riskAnswer.bullets.some((line) => line.includes("src/lib/risky.ts"))).toBe(true);
    expect(riskEvidence?.kind).toBe("danger_zone");
    expect(riskAnswer.evidence_refs).toContain(riskEvidence?.id);
  });

  it("does not invent suggested files outside evidence", () => {
    const brief = buildCandidateBrief(baseInput);
    const evidencePaths = new Set(
      brief.evidence_refs.map((ref) => ref.path).filter((path): path is string => Boolean(path))
    );

    for (const idea of brief.first_pr_plan) {
      expect(idea.evidence_refs.length).toBeGreaterThan(0);
      for (const suggestedFile of idea.suggested_files) {
        expect(evidencePaths.has(suggestedFile)).toBe(true);
      }
    }
  });

  it("degrades gracefully with empty commands, docs, CI, and danger zones", () => {
    const brief = buildCandidateBrief({
      repoName: "empty-signals",
      startHere: [],
      dangerZones: [],
      runCommands: [],
      contributeSignals: {
        key_docs: [],
        ci_configs: [],
      },
      architecture: {
        nodes: [],
        edges: [],
      },
      warnings: [],
    });

    expect(brief.repo_summary.confidence).toBe("low");
    expect(brief.reading_path).toEqual([]);
    expect(brief.first_pr_plan.length).toBeGreaterThan(0);
    expect(brief.first_pr_plan.length).toBeLessThanOrEqual(3);
    expect(brief.first_pr_plan.every((idea) => idea.evidence_refs.length > 0)).toBe(true);
    expect(brief.interview_talking_points.riskiest_areas.confidence).toBe("low");
    expect(brief.warnings.some((warning) => warning.message.includes("No danger-zone"))).toBe(true);
    expect(brief.warnings.some((warning) => warning.message.includes("No run commands"))).toBe(true);
  });

  it("only references evidence IDs that exist", () => {
    const brief = buildCandidateBrief(baseInput);
    const knownIds = new Set(brief.evidence_refs.map((ref) => ref.id));

    for (const id of collectReferencedIds(brief)) {
      expect(knownIds.has(id)).toBe(true);
    }
  });

  it("requires direct decision evidence before presenting a tradeoff hook", () => {
    const brief = buildCandidateBrief({
      ...baseInput,
      technicalDecisions: [
        { category: "framework" as const, decision: "React", signals: ["react"], evidence_refs: [] },
        { category: "testing" as const, decision: "Vitest", signals: ["vitest"], evidence_refs: [] },
      ],
    });

    const tradeoff = brief.behavioral_hooks?.find((hook) => hook.prompt.startsWith("Tradeoff"));
    expect(tradeoff).toEqual({
      prompt: "Tradeoff (STAR template)",
      answer_starter: "Not enough evidence — use a different example or skip this prompt.",
      evidence_refs: [],
      sufficient_evidence: false,
    });
    expect(brief.walkthrough_script?.tradeoffs_to_mention).toEqual([]);
  });

  it("links every displayed technical decision to direct repository evidence", () => {
    const technicalDecisionEvidence = [
      { id: "decision-1", kind: "decision" as const, label: "Package manifest", path: "package.json" },
      { id: "decision-2", kind: "decision" as const, label: "Test config", path: "vitest.config.ts" },
    ];
    const brief = buildCandidateBrief({
      ...baseInput,
      technicalDecisions: [
        { category: "framework" as const, decision: "React", signals: ["react"], evidence_refs: ["decision-1"] },
        { category: "testing" as const, decision: "Vitest", signals: ["vitest"], evidence_refs: ["decision-2"] },
      ],
      technicalDecisionEvidence,
    });

    const tradeoff = brief.behavioral_hooks?.find((hook) => hook.prompt.startsWith("Tradeoff"));
    expect(tradeoff?.sufficient_evidence).toBe(true);
    expect(tradeoff?.evidence_refs).toEqual(["decision-1", "decision-2"]);
    expect(brief.walkthrough_script?.tradeoffs_to_mention).toEqual(["React", "Vitest"]);
    expect(brief.walkthrough_script?.evidence_refs).toEqual(
      expect.arrayContaining(["decision-1", "decision-2"])
    );
    expect(brief.evidence_refs.filter((ref) => ref.kind === "decision")).toEqual(
      expect.arrayContaining(technicalDecisionEvidence)
    );
  });

  it("does not claim bugs, vulnerabilities, production readiness, or business purpose", () => {
    const brief = buildCandidateBrief(baseInput);
    const serialized = JSON.stringify(brief).toLowerCase();

    expect(serialized).not.toContain("vulnerability");
    expect(serialized).not.toContain("vulnerabilities");
    expect(serialized).not.toContain("production ready");
    expect(serialized).not.toContain("has bugs");
    expect(serialized).not.toContain("business purpose");
  });

  it.each([
    ["bug", "Bug investigation"],
    ["planned_change", "Planned change"],
    ["pull_request", "Pull-request discussion"],
  ] as const)("builds an evidence-linked %s focus", (analysisIntent, expectedLabel) => {
    const brief = buildCandidateBrief({ ...baseInput, analysisIntent });
    const focus = brief.analysis_focus;
    const knownIds = new Set(brief.evidence_refs.map((ref) => ref.id));

    expect(focus?.intent).toBe(analysisIntent);
    expect(focus?.label).toBe(expectedLabel);
    expect(focus?.review_steps).toHaveLength(3);
    expect(focus?.discussion_questions).toHaveLength(3);
    for (const step of focus?.review_steps ?? []) {
      expect(step.evidence_refs.length).toBeGreaterThan(0);
      expect(step.evidence_refs.every((id) => knownIds.has(id))).toBe(true);
    }
    const validationStep = focus?.review_steps[2];
    expect(
      brief.evidence_refs.find((ref) => ref.id === validationStep?.evidence_refs[0])?.kind
    ).toBe("command");
  });

  it("keeps the default interview brief free of issue-focus framing", () => {
    const brief = buildCandidateBrief(baseInput);
    expect(brief.analysis_focus).toBeUndefined();
  });
});
