import { describe, expect, it } from "vitest";
import { exportReportToMarkdown } from "./export";
import type { Report } from "@/types/report";

function sampleReport(): Report {
  return {
    repo_metadata: {
      name: "repo-atlas",
      url: "zip",
      branch: "unknown",
      clone_hash: null,
      analyzed_at: "2026-07-08T12:00:00.000Z",
    },
    folder_map: {
      path: ".",
      type: "dir",
      children: [{ path: "README.md", type: "file" }],
    },
    architecture: {
      nodes: [{ id: "src", label: "src", type: "folder" }],
      edges: [],
    },
    start_here: [
      {
        path: "README.md",
        score: 100,
        explanation: "root README documentation",
      },
    ],
    danger_zones: [
      {
        path: "src/analyzer/scoring.ts",
        score: 82,
        breakdown: "high complexity, low test proximity",
        metrics: { complexity: 20, test_proximity: 0 },
      },
    ],
    run_commands: [
      { source: "package.json", command: "npm run test", description: "test" },
    ],
    contribute_signals: {
      key_docs: ["README.md"],
      ci_configs: [".github/workflows/ci.yml"],
    },
    candidate_brief: {
      repo_summary: {
        headline: "repo-atlas has a ranked onboarding path starting at README.md",
        plain_english:
          "RepoAtlas found reading candidates, risk-ranked files, run commands, key docs, and CI configs.",
        primary_evidence: ["start-1", "risk-1"],
        confidence: "high",
      },
      reading_path: [
        {
          order: 1,
          title: "README.md",
          path: "README.md",
          why: "root README documentation",
          evidence_refs: ["start-1"],
        },
      ],
      interview_talking_points: {
        walk_me_through_codebase: {
          answer: "Start from the ranked reading path.",
          bullets: ["Read README.md first."],
          evidence_refs: ["start-1"],
          confidence: "high",
        },
        riskiest_areas: {
          answer: "Use danger-zone files for risk discussion.",
          bullets: ["src/analyzer/scoring.ts has risk score 82."],
          evidence_refs: ["risk-1"],
          confidence: "medium",
        },
        improve_first: {
          answer: "Improve evidence-backed docs or tests first.",
          bullets: ["Add coverage around the risk-ranked file."],
          evidence_refs: ["risk-1"],
          confidence: "medium",
        },
        first_week_contribution: {
          answer: "Read, validate commands, then open a scoped PR.",
          bullets: ["Run npm run test."],
          evidence_refs: ["cmd-1"],
          confidence: "medium",
        },
      },
      first_pr_plan: [
        {
          title: "Add test coverage around src/analyzer/scoring.ts",
          rationale: "The file is risk-ranked and has low test proximity.",
          suggested_files: ["src/analyzer/scoring.ts"],
          evidence_refs: ["risk-1"],
          risk: "medium",
        },
      ],
      resume_bullets: [
        {
          audience: "resume",
          text: "Analyzed repo-atlas with deterministic static analysis signals.",
          evidence_refs: ["start-1", "risk-1"],
        },
      ],
      evidence_refs: [
        {
          id: "start-1",
          kind: "start_here",
          label: "Reading candidate: README.md",
          path: "README.md",
          detail: "Priority 100: root README documentation",
        },
        {
          id: "risk-1",
          kind: "danger_zone",
          label: "Risk candidate: src/analyzer/scoring.ts",
          path: "src/analyzer/scoring.ts",
          detail: "Risk 82: high complexity, low test proximity",
        },
        {
          id: "cmd-1",
          kind: "command",
          label: "Run command: npm run test",
          command: "npm run test",
          detail: "Source: package.json; test",
        },
      ],
      warnings: [
        {
          message: "Deep Python analysis unavailable.",
          evidence_refs: ["start-1"],
        },
      ],
    },
    warnings: [],
  };
}

describe("exportReportToMarkdown", () => {
  it("includes Candidate Brief content and evidence references when available", () => {
    const markdown = exportReportToMarkdown(sampleReport());

    expect(markdown).toContain("## Candidate Brief");
    expect(markdown).toContain("### Repo Summary");
    expect(markdown).toContain("### Reading Path");
    expect(markdown).toContain("### Interview Talking Points");
    expect(markdown).toContain("### First PR Plan");
    expect(markdown).toContain("### Resume / LinkedIn Bullets");
    expect(markdown).toContain("### Evidence References");
    expect(markdown).toContain("`start-1`");
    expect(markdown).toContain("`risk-1`");
    expect(markdown).toContain("src/analyzer/scoring.ts");
  });

  it("does not crash when candidate_brief is missing", () => {
    const report = sampleReport();
    delete report.candidate_brief;

    const markdown = exportReportToMarkdown(report);

    expect(markdown).toContain("# Repo Brief: repo-atlas");
    expect(markdown).toContain("## Folder Map");
    expect(markdown).toContain("## Start Here");
    expect(markdown).not.toContain("## Candidate Brief");
  });

  it("keeps existing export sections", () => {
    const markdown = exportReportToMarkdown(sampleReport());

    expect(markdown).toContain("## Folder Map");
    expect(markdown).toContain("## Architecture");
    expect(markdown).toContain("## Start Here");
    expect(markdown).toContain("## Danger Zones");
    expect(markdown).toContain("## Run & Contribute");
  });
});
