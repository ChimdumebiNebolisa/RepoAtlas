"use client";

import { useState } from "react";
import { InputForm } from "@/components/InputForm";
import { ReportTabs } from "@/components/ReportTabs";
import type { Report } from "@/types/report";

function Badge({ label }: { label: string }) {
  return (
    <span className="rounded-full border border-emerald-100 bg-white/95 px-3 py-1 text-xs font-medium text-slate-700 shadow-sm">
      {label}
    </span>
  );
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
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-emerald-200">
      <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
        <span className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-emerald-50 text-emerald-700">
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
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="-mx-5 -mt-5 mb-4 flex items-center justify-between rounded-t-2xl border-b border-slate-200 bg-slate-50 px-5 py-3">
        <h2 className="text-base font-semibold text-slate-900">Repo Brief Preview</h2>
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

  const handleAnalyzeComplete = (reportData: Report, id: string) => {
    setReport(reportData);
    setReportId(id);
    setLoading(false);
    setError(null);
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
    <main className="relative isolate min-h-screen overflow-hidden bg-gradient-to-b from-slate-50 to-white">
      <div className="pointer-events-none absolute inset-x-0 top-0 z-0 h-[26rem]">
        <div className="absolute -left-20 -top-10 h-72 w-72 rounded-full bg-gradient-to-tr from-emerald-300/35 via-green-200/25 to-transparent blur-3xl" />
        <div className="absolute right-0 top-24 h-72 w-72 rounded-full bg-gradient-to-tr from-green-300/30 via-emerald-200/25 to-transparent blur-3xl" />
      </div>

      <div className="relative z-10 mx-auto max-w-6xl px-6 py-10">
        <header className="flex items-start justify-between gap-4">
          <div>
            <p className="text-2xl font-bold tracking-tight text-slate-900">RepoAtlas</p>
            <p className="text-sm text-slate-700">Repository Brief Generator</p>
          </div>
          <div className="hidden items-center gap-2 sm:flex">
            <Badge label="Read-only · never runs code" />
            <Badge label="JSON + Markdown export" />
          </div>
        </header>

        <section className="mt-10">
          <h1 className="max-w-3xl text-4xl font-semibold tracking-[-0.02em] text-slate-950 sm:text-5xl sm:leading-[1.08]">
            Map{" "}
            <span className="bg-gradient-to-r from-emerald-700 to-green-600 bg-clip-text text-transparent">
              any{" "}
            </span>
            <span className="text-slate-950">codebase in{" "}</span>
            <span className="bg-gradient-to-r from-emerald-700 to-green-600 bg-clip-text text-transparent">
              seconds
            </span>
            .
          </h1>
          <p className="mt-4 max-w-xl text-base leading-7 text-slate-700">
            Understand unfamiliar code faster, onboard new teammates with confidence, and
            spot risky hotspots before they slow you down.
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            <Badge label="Onboard faster" />
            <Badge label="Spot risks" />
            <Badge label="Export docs" />
          </div>
        </section>

        <section className="mt-10 grid gap-6 lg:grid-cols-2 lg:items-start">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-semibold text-slate-900">Analyze a repository</h2>
            <p className="mt-2 text-sm text-slate-700">
              Paste a public GitHub URL. Deep analysis is currently available for TS/JS and Python repos.
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
            </div>

            <div className="mt-5">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                Try an example
              </p>
              <div className="flex flex-wrap gap-2">
                {[
                  "https://github.com/vercel/next.js",
                  "https://github.com/tailwindlabs/tailwindcss",
                  "https://github.com/facebook/react",
                ].map((example) => (
                  <button
                    key={example}
                    type="button"
                    onClick={() => {
                      setPrefillUrl(example);
                      setError(null);
                    }}
                    className="rounded-md border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-slate-700 transition hover:border-emerald-200 hover:bg-emerald-50/70"
                  >
                    {example.replace("https://github.com/", "")}
                  </button>
                ))}
              </div>
            </div>

            {error && (
              <div className="mt-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
                {error}
              </div>
            )}
          </div>

          <PreviewMock />
        </section>

        <section className="mt-14">
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

        <section className="mt-14 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-2xl font-semibold tracking-tight text-slate-900">
            How it works
          </h2>
          <ol className="mt-5 grid gap-4 text-sm text-slate-700 sm:grid-cols-3">
            <li className="rounded-xl border border-emerald-100 bg-gradient-to-br from-emerald-50 to-white p-4">
              <div className="mb-2 inline-flex h-7 w-7 items-center justify-center rounded-full bg-emerald-700 text-xs font-bold text-white">
                1
              </div>
              <p className="font-semibold text-slate-900">Paste a public GitHub URL</p>
              <p className="mt-1 text-xs text-slate-600">
                Start analysis in seconds with no local setup.
              </p>
            </li>
            <li className="rounded-xl border border-green-100 bg-gradient-to-br from-green-50 to-white p-4">
              <div className="mb-2 inline-flex h-7 w-7 items-center justify-center rounded-full bg-green-700 text-xs font-bold text-white">
                2
              </div>
              <p className="font-semibold text-slate-900">
                RepoAtlas maps structure and import relationships
              </p>
              <p className="mt-1 text-xs text-slate-600">
                Deterministic signals highlight architecture and coupling.
              </p>
            </li>
            <li className="rounded-xl border border-emerald-100 bg-gradient-to-br from-emerald-50 to-white p-4">
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
          <section className="mt-14">
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
