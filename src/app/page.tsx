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
  const [prefillUrl, setPrefillUrl] = useState("");
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
            <p className="text-sm text-slate-700">Repository Brief Generator</p>
          </div>
          <div className="hidden items-center gap-2 sm:flex">
            <Badge label="TS/JS + Python + Java" />
            <Badge label="Markdown, images & PDFs" />
          </div>
        </header>

        <section className="mt-12 space-y-5">
          <h1 className="max-w-3xl text-4xl font-semibold tracking-[-0.02em] text-slate-950 sm:text-5xl sm:leading-[1.08]">
            Map{" "}
            <span className="text-slate-950">any{" "}</span>
            <span className="bg-gradient-to-r from-emerald-700 to-green-600 bg-clip-text text-transparent">
              codebase
            </span>
            <span className="text-slate-950"> in </span>
            <span className="bg-gradient-to-r from-emerald-700 to-green-600 bg-clip-text text-transparent">
              seconds
            </span>
            .
          </h1>
          <p className="max-w-xl text-base leading-7 text-slate-700">
            Understand unfamiliar code faster, onboard new teammates with confidence, and
            spot risky hotspots before they slow you down.
          </p>
          <div className="flex flex-wrap gap-2">
            <Badge label="Onboard faster" />
            <Badge label="Spot risks" />
            <Badge label="Export docs" />
          </div>
        </section>

        <section className="mt-[var(--section-gap)] grid gap-6 lg:grid-cols-2 lg:items-start">
          <div className="surface surface-2xl p-6">
            <div className="surface-header mb-4">
              <h2 className="text-base font-semibold text-slate-900">Analyze a repository</h2>
              <span aria-hidden="true" />
            </div>
            <p className="text-sm text-slate-700">
              Paste a public GitHub URL. Deep analysis is currently available for TS/JS, Python, and Java repos.
            </p>

            <div className="mt-5">
              <InputForm
                onAnalyzeStart={handleAnalyzeStart}
                onAnalyzeComplete={handleAnalyzeComplete}
                onAnalyzeError={handleAnalyzeError}
                loading={loading}
                prefillUrl={prefillUrl}
              />
              <p className="mt-3 text-xs text-slate-600">
                Reads repo files only. Never runs code.
              </p>
              <p className="mt-1.5 text-xs text-slate-500">
                Public repos only · Max 100MB · Analysis up to 2 min
              </p>
            </div>

            <div className="mt-5">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                Try an example
              </p>
              <div className="flex flex-wrap gap-2">
                {["https://github.com/tailwindlabs/tailwindcss"].map((example) => (
                  <button
                    key={example}
                    type="button"
                    onClick={() => {
                      setPrefillUrl(example);
                      setError(null);
                    }}
                    className="btn btn-secondary h-10 px-3 text-xs"
                  >
                    {example.replace("https://github.com/", "")}
                  </button>
                ))}
              </div>
            </div>

            {showViewReportButton && report && (
              <div className="mt-5">
                <button
                  type="button"
                  onClick={scrollToReport}
                  className="btn btn-secondary border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                >
                  View report ↓
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
              title="Folder Map"
              description="A quick top-down view of key directories and where major functionality lives."
              iconPath="M3 7h6l2 2h10v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z"
            />
            <FeatureCard
              title="Architecture Map"
              description="A concise Mermaid-ready outline of system components and relationships."
              iconPath="M5 5h5v5H5zM14 5h5v5h-5zM14 14h5v5h-5zM10 7.5h4M16.5 10v4"
            />
            <FeatureCard
              title="Start Here"
              description="A ranked reading path with deterministic signals showing why each file matters."
              iconPath="M6 4h10l4 4v12H6zM16 4v4h4M9 12h6M9 16h4"
            />
            <FeatureCard
              title="Danger Zones"
              description="Potentially risky hotspots flagged for complexity, coupling, or churn."
              iconPath="M12 3l9 16H3L12 3Zm0 6v4m0 4h.01"
            />
            <FeatureCard
              title="Run & Contribute"
              description="Useful run commands and contribution pointers extracted from the repo."
              iconPath="M8 8 4 12l4 4M16 8l4 4-4 4M10 19l4-14"
            />
            <FeatureCard
              title="Export"
              description="Structured JSON and markdown-friendly output for docs and handoff notes."
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
              <p className="font-semibold text-slate-900">Paste a public GitHub URL</p>
              <p className="mt-1 text-xs text-slate-600">
                Start analysis in seconds with no local setup.
              </p>
            </li>
            <li className="panel surface-lg p-4">
              <div className="mb-2 inline-flex h-7 w-7 items-center justify-center rounded-full bg-emerald-700 text-xs font-bold text-white">
                2
              </div>
              <p className="font-semibold text-slate-900">
                RepoAtlas maps structure and import relationships
              </p>
              <p className="mt-1 text-xs text-slate-600">
                Deterministic signals highlight architecture and coupling.
              </p>
            </li>
            <li className="panel surface-lg p-4">
              <div className="mb-2 inline-flex h-7 w-7 items-center justify-center rounded-full bg-emerald-700 text-xs font-bold text-white">
                3
              </div>
              <p className="font-semibold text-slate-900">
                Get a Repo Brief with ranked start points and risk zones
              </p>
              <p className="mt-1 text-xs text-slate-600">
                Export JSON or Markdown for docs, handoffs, and reviews.
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
