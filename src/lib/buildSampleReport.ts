import { buildCandidateBrief } from "@/analyzer/interview";
import type { Report } from "@/types/report";

const base: Omit<Report, "candidate_brief"> = {
  repo_metadata: {
    name: "repo-atlas",
    url: "https://github.com/owner/repo-atlas",
    branch: "main",
    clone_hash: "sample",
    analyzed_at: "2026-02-14T12:34:00Z",
  },
  folder_map: {
    path: "src",
    type: "dir",
    children: [
      {
        path: "src/app",
        type: "dir",
        children: [
          { path: "src/app/page.tsx", type: "file" },
          { path: "src/app/layout.tsx", type: "file" },
          {
            path: "src/app/api",
            type: "dir",
            children: [{ path: "src/app/api/analyze/route.ts", type: "file" }],
          },
        ],
      },
      {
        path: "src/analyzer",
        type: "dir",
        children: [
          { path: "src/analyzer/index.ts", type: "file" },
          { path: "src/analyzer/scoring.ts", type: "file" },
        ],
      },
      {
        path: "src/components",
        type: "dir",
        children: [
          { path: "src/components/InputForm.tsx", type: "file" },
          { path: "src/components/ReportTabs.tsx", type: "file" },
        ],
      },
    ],
  },
  architecture: {
    nodes: [
      { id: "InputForm", label: "InputForm" },
      { id: "AnalyzeRoute", label: "/api/analyze route" },
      { id: "Analyzer", label: "Analyzer Pipeline" },
      { id: "Scoring", label: "Scoring Engine" },
      { id: "ReportTabs", label: "ReportTabs" },
      { id: "Export", label: "Export Layer" },
    ],
    edges: [
      { from: "InputForm", to: "AnalyzeRoute" },
      { from: "AnalyzeRoute", to: "Analyzer" },
      { from: "Analyzer", to: "Scoring" },
      { from: "Analyzer", to: "ReportTabs" },
      { from: "ReportTabs", to: "Export" },
    ],
  },
  start_here: [
    {
      path: "README.md",
      score: 95,
      explanation: "Project scope, setup, and quick start for onboarding.",
    },
    {
      path: "src/app/page.tsx",
      score: 90,
      explanation: "Main app shell, UX, and report wiring.",
    },
    {
      path: "src/app/api/analyze/route.ts",
      score: 86,
      explanation: "Entry point for analysis and report generation.",
    },
  ],
  danger_zones: [
    {
      path: "src/analyzer/scoring.ts",
      score: 82,
      breakdown: "Dense logic with multiple weighted heuristics and branching.",
      metrics: { complexity: 78, fan_in: 12, fan_out: 10 },
    },
    {
      path: "src/analyzer/packs/tsjs.ts",
      score: 76,
      breakdown: "High fan-out and parser-like control flow patterns.",
      metrics: { complexity: 71, fan_in: 9, fan_out: 14 },
    },
  ],
  run_commands: [
    { source: "package.json", command: "npm run dev", description: "Start dev server" },
    { source: "package.json", command: "npm run build", description: "Build for production" },
    { source: "package.json", command: "npm run test", description: "Run test suite" },
  ],
  contribute_signals: {
    key_docs: ["README.md", "docs/guardrails.md"],
    ci_configs: [".github/workflows/ci.yml"],
  },
  warnings: [],
};

export function buildSampleReport(): Report {
  return {
    ...base,
    candidate_brief: buildCandidateBrief({
      repoName: base.repo_metadata.name,
      startHere: base.start_here,
      dangerZones: base.danger_zones,
      runCommands: base.run_commands,
      contributeSignals: base.contribute_signals,
      architecture: base.architecture,
      warnings: base.warnings,
      projectProfile: {
        type: "nextjs",
        label: "Next.js application",
        confidence: "high",
        signals: ["src/app/page.tsx", "next dependency"],
        evidence_refs: [],
      },
      projectPurpose: {
        text: "Evidence-backed Candidate Briefs for interviews and onboarding",
        source: "readme_heading",
        path: "README.md",
        extracted: true,
        evidence_refs: [],
      },
      technicalDecisions: [
        {
          category: "framework",
          decision: "Next.js",
          signals: ["package.json: next"],
          evidence_refs: ["sample-decision-package"],
        },
        {
          category: "styling",
          decision: "Tailwind CSS",
          signals: ["package.json: tailwindcss"],
          evidence_refs: ["sample-decision-package"],
        },
        {
          category: "testing",
          decision: "Vitest",
          signals: ["package.json: vitest"],
          evidence_refs: ["sample-decision-package"],
        },
      ],
      technicalDecisionEvidence: [
        {
          id: "sample-decision-package",
          kind: "decision",
          label: "Technical decision source: package.json",
          path: "package.json",
          detail: "Bundled sample manifest used for deterministic technical-decision detection.",
        },
      ],
    }),
  };
}
