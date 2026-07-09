"use client";

import { useState, useRef } from "react";
import { InputForm } from "@/components/InputForm";
import { ReportTabs } from "@/components/ReportTabs";
import type { Report } from "@/types/report";

function Badge({ label }: { label: string }) {
  return <span className="badge">{label}</span>;
}

function FeatureCard({
  title,
  description,
  iconPath,
}: {
  title: string;
  description: string;
  iconPath: string;
}) {
  return (
    <div className="surface surface-lg p-5 transition duration-200 hover:border-emerald-200/80">
      <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
        <span className="inline-flex h-6 w-6 items-center justify-center rounded-md border border-emerald-100 bg-emerald-50 text-emerald-700">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            className="h-4 w-4"
            aria-hidden="true"
          >
            <path d={iconPath} strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
        {title}
      </h3>
      <p className="mt-2 text-sm leading-6 text-slate-700">{description}</p>
    </div>
  );
}

const SAMPLE_REPORT: Report = {
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
  candidate_brief: {
    repo_summary: {
      headline: "repo-atlas has a ranked onboarding path starting at README.md",
      plain_english:
        "This read-only sample presents RepoAtlas as a static analysis app with UI, API, analyzer, scoring, and export layers.",
      primary_evidence: ["start-1", "risk-1", "arch-1"],
      confidence: "high",
    },
    reading_path: [
      {
        order: 1,
        title: "README.md",
        path: "README.md",
        why: "Project scope, setup, and quick start for onboarding.",
        evidence_refs: ["start-1"],
      },
      {
        order: 2,
        title: "page.tsx",
        path: "src/app/page.tsx",
        why: "Main app shell, upload flow, and report wiring.",
        evidence_refs: ["start-2"],
      },
      {
        order: 3,
        title: "route.ts",
        path: "src/app/api/analyze/route.ts",
        why: "API entry point for repository analysis.",
        evidence_refs: ["start-3"],
      },
    ],
    interview_talking_points: {
      walk_me_through_codebase: {
        answer:
          "Start with the page and analyze route, then follow the request into the analyzer, scoring, report tabs, and export layer.",
        bullets: [
          "The UI uploads a repository zip.",
          "The API invokes the in-process analyzer.",
          "The report tabs render deterministic analysis results.",
        ],
        evidence_refs: ["start-2", "start-3", "arch-1"],
        confidence: "high",
      },
      riskiest_areas: {
        answer:
          "The sample risk ranking points to scoring and language-pack logic because those files combine branching and dependency signals.",
        bullets: [
          "src/analyzer/scoring.ts has the highest sample risk score.",
          "src/analyzer/packs/tsjs.ts has high sample fan-out.",
        ],
        evidence_refs: ["risk-1", "risk-2"],
        confidence: "medium",
      },
      improve_first: {
        answer:
          "Start with a scoped test or documentation improvement around a risk-ranked analyzer file.",
        bullets: ["Keep the first change evidence-backed and limited in scope."],
        evidence_refs: ["risk-1"],
        confidence: "medium",
      },
      first_week_contribution: {
        answer:
          "Read the ranked files, validate the detected npm commands, inspect the top risk area, and propose one small test or documentation PR.",
        bullets: ["Run npm run test and npm run build before proposing changes."],
        evidence_refs: ["start-1", "cmd-1", "risk-1"],
        confidence: "high",
      },
    },
    first_pr_plan: [
      {
        title: "Add coverage around scoring behavior",
        rationale:
          "The sample ranks scoring.ts as a high-risk file, making focused test coverage a realistic contribution.",
        suggested_files: ["src/analyzer/scoring.ts"],
        evidence_refs: ["risk-1"],
        risk: "medium",
      },
      {
        title: "Verify documented run commands",
        rationale:
          "The sample detects development, test, and build scripts that can be checked against setup guidance.",
        suggested_files: ["README.md"],
        evidence_refs: ["cmd-1", "doc-1"],
        risk: "low",
      },
      {
        title: "Align contributor guidance with CI",
        rationale:
          "A CI configuration is present, so contributor notes can reference the same validation path.",
        suggested_files: ["README.md", ".github/workflows/ci.yml"],
        evidence_refs: ["doc-1", "ci-1"],
        risk: "low",
      },
    ],
    resume_bullets: [
      {
        audience: "resume",
        text: "Analyzed RepoAtlas with deterministic static signals to produce a reading path, risk areas, contribution ideas, and evidence-backed interview talking points.",
        evidence_refs: ["start-1", "risk-1", "arch-1"],
      },
      {
        audience: "linkedin",
        text: "Used RepoAtlas to turn repository structure, commands, architecture, and risk signals into an evidence-backed Candidate Brief.",
        evidence_refs: ["start-1", "cmd-1", "arch-1"],
      },
    ],
    evidence_refs: [
      { id: "start-1", kind: "start_here", label: "README", path: "README.md" },
      { id: "start-2", kind: "start_here", label: "App page", path: "src/app/page.tsx" },
      {
        id: "start-3",
        kind: "start_here",
        label: "Analyze route",
        path: "src/app/api/analyze/route.ts",
      },
      {
        id: "risk-1",
        kind: "danger_zone",
        label: "Scoring risk signal",
        path: "src/analyzer/scoring.ts",
      },
      {
        id: "risk-2",
        kind: "danger_zone",
        label: "TS/JS pack risk signal",
        path: "src/analyzer/packs/tsjs.ts",
      },
      { id: "cmd-1", kind: "command", label: "Test command", command: "npm run test" },
      { id: "doc-1", kind: "doc", label: "Project README", path: "README.md" },
      {
        id: "ci-1",
        kind: "ci",
        label: "CI configuration",
        path: ".github/workflows/ci.yml",
      },
      {
        id: "arch-1",
        kind: "architecture",
        label: "Sample architecture graph",
        detail: "UI, API, analyzer, scoring, report, and export relationships.",
      },
    ],
    warnings: [],
  },
  warnings: [],
};

function PreviewMock() {
  return (
    <div className="surface surface-2xl p-6">
      <div className="surface-header mb-4">
        <h2 className="text-base font-semibold text-slate-900">Sample Repo</h2>
        <span className="text-xs text-slate-500">Read-only sample</span>
      </div>
      <ReportTabs report={SAMPLE_REPORT} variant="preview" />
    </div>
  );
}

export default function Home() {
  const [report, setReport] = useState<Report | null>(null);
  const [reportId, setReportId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showViewReportButton, setShowViewReportButton] = useState(false);
  const reportSectionRef = useRef<HTMLElement | null>(null);

  const scrollToReport = () => {
    reportSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    setShowViewReportButton(false);
  };

  const handleAnalyzeComplete = (reportData: Report, id: string) => {
    setReport(reportData);
    setReportId(id);
    setLoading(false);
    setError(null);
    setShowViewReportButton(true);
  };

  const handleAnalyzeStart = () => {
    setLoading(true);
    setError(null);
  };

  const handleAnalyzeError = (message: string) => {
    setError(message);
    setLoading(false);
  };

  return (
    <main className="relative isolate min-h-screen overflow-hidden bg-[var(--color-background)]">
      <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(70%_45%_at_10%_0%,rgba(16,185,129,0.16),transparent_72%),radial-gradient(45%_35%_at_90%_8%,rgba(34,197,94,0.12),transparent_72%)]" />
        <div className="absolute inset-0 opacity-30 [background-image:linear-gradient(to_right,rgba(15,23,42,0.05)_1px,transparent_1px),linear-gradient(to_bottom,rgba(15,23,42,0.05)_1px,transparent_1px)] [background-size:28px_28px]" />
      </div>

      <div className="relative z-10 mx-auto w-full max-w-[var(--container-max)] px-4 py-10 sm:px-6">
        <header className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <p className="text-2xl font-bold tracking-tight text-slate-900">RepoAtlas</p>
            <p className="text-sm text-slate-700">Evidence-backed Candidate Briefs</p>
          </div>
          <div className="hidden items-center gap-2 sm:flex">
            <Badge label="TS/JS + Python + Java" />
            <Badge label="Markdown, images & PDFs" />
          </div>
        </header>

        <section className="mt-12 space-y-5">
          <h1 className="max-w-3xl text-4xl font-semibold tracking-[-0.02em] text-slate-950 sm:text-5xl sm:leading-[1.08]">
            Understand an{" "}
            <span className="bg-gradient-to-r from-emerald-700 to-green-600 bg-clip-text text-transparent">
              unfamiliar codebase
            </span>
            <span className="text-slate-950"> before the interview.</span>
          </h1>
          <p className="max-w-xl text-base leading-7 text-slate-700">
            Upload a repository zip and get a deterministic Candidate Brief with a reading
            path, interview talking points, first PR ideas, and evidence references.
          </p>
          <div className="flex flex-wrap gap-2">
            <Badge label="Interview prep" />
            <Badge label="Take-home prep" />
            <Badge label="Contribution prep" />
          </div>
        </section>

        <section className="mt-[var(--section-gap)] grid gap-6 lg:grid-cols-2 lg:items-start">
          <div className="surface surface-2xl p-6">
            <div className="surface-header mb-4">
              <h2 className="text-base font-semibold text-slate-900">Analyze a repository</h2>
              <span aria-hidden="true" />
            </div>
            <p className="text-sm text-slate-700">
              Upload a repository zip. RepoAtlas reads static files and builds an
              evidence-backed brief without running project code.
            </p>

            <div className="mt-5">
              <InputForm
                onAnalyzeStart={handleAnalyzeStart}
                onAnalyzeComplete={handleAnalyzeComplete}
                onAnalyzeError={handleAnalyzeError}
                loading={loading}
              />
              <p className="mt-3 text-xs text-slate-600">
                Reads repo files only. Never runs code.
              </p>
              <p className="mt-1.5 text-xs text-slate-500">
                Max 100MB | Analysis up to 2 min
              </p>
            </div>

            {showViewReportButton && report && (
              <div className="mt-5">
                <button
                  type="button"
                  onClick={scrollToReport}
                  className="btn btn-secondary border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                >
                  View report
                </button>
              </div>
            )}

            {error && (
              <div className="mt-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
                {error}
              </div>
            )}
          </div>

          <PreviewMock />
        </section>

        <section className="mt-[var(--section-gap)]">
          <h2 className="text-2xl font-semibold tracking-tight text-slate-900">
            What you get
          </h2>
          <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <FeatureCard
              title="Candidate Brief"
              description="An evidence-backed summary built for interviews, take-homes, and contribution prep."
              iconPath="M6 4h10l4 4v12H6zM16 4v4h4M9 12h6M9 16h4"
            />
            <FeatureCard
              title="Reading Path"
              description="A ranked sequence of docs, entrypoints, routes, and central modules to inspect first."
              iconPath="M4 6h16M4 12h10M4 18h7"
            />
            <FeatureCard
              title="Interview Talking Points"
              description="Structured answers for codebase walkthroughs, risks, improvements, and first-week contributions."
              iconPath="M4 5h16v11H8l-4 4V5Z"
            />
            <FeatureCard
              title="First PR Plan"
              description="Three scoped contribution ideas tied to docs, commands, CI, tests, warnings, and risk signals."
              iconPath="M5 5h14v14H5zM8 12h8M12 8v8"
            />
            <FeatureCard
              title="Architecture & Risk"
              description="Folder maps, dependency structure, Start Here rankings, and measurable danger-zone signals."
              iconPath="M5 5h5v5H5zM14 5h5v5h-5zM14 14h5v5h-5zM10 7.5h4M16.5 10v4"
            />
            <FeatureCard
              title="Export"
              description="Portable Markdown, PDF, and PNG reports with Candidate Brief evidence included."
              iconPath="M12 3v12m0 0 4-4m-4 4-4-4M5 15v4h14v-4"
            />
          </div>
        </section>

        <section className="surface surface-2xl mt-[var(--section-gap)] p-6 shadow-none">
          <h2 className="text-2xl font-semibold tracking-tight text-slate-900">
            How it works
          </h2>
          <ol className="mt-5 grid gap-4 text-sm text-slate-700 sm:grid-cols-3">
            <li className="panel surface-lg p-4">
              <div className="mb-2 inline-flex h-7 w-7 items-center justify-center rounded-full bg-emerald-700 text-xs font-bold text-white">
                1
              </div>
              <p className="font-semibold text-slate-900">Upload a zip of your repo</p>
              <p className="mt-1 text-xs text-slate-600">
                Zip the repo folder and upload. No GitHub link required.
              </p>
            </li>
            <li className="panel surface-lg p-4">
              <div className="mb-2 inline-flex h-7 w-7 items-center justify-center rounded-full bg-emerald-700 text-xs font-bold text-white">
                2
              </div>
              <p className="font-semibold text-slate-900">
                RepoAtlas indexes evidence
              </p>
              <p className="mt-1 text-xs text-slate-600">
                Static analysis maps structure, imports, docs, commands, tests, CI, and risk.
              </p>
            </li>
            <li className="panel surface-lg p-4">
              <div className="mb-2 inline-flex h-7 w-7 items-center justify-center rounded-full bg-emerald-700 text-xs font-bold text-white">
                3
              </div>
              <p className="font-semibold text-slate-900">
                Review the Candidate Brief
              </p>
              <p className="mt-1 text-xs text-slate-600">
                Rehearse talking points, inspect evidence, and export the complete report.
              </p>
            </li>
          </ol>
        </section>

        {report && reportId && (
          <section ref={reportSectionRef} className="mt-[var(--section-gap)]">
            <ReportTabs report={report} reportId={reportId} />
          </section>
        )}

        <footer className="mt-12 border-t border-slate-200 pt-6 text-xs text-slate-600">
          RepoAtlas generates signals from repo files only. No code execution.
        </footer>
      </div>
    </main>
  );
}
