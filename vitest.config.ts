import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  esbuild: {
    jsx: "automatic",
  },
  test: {
    setupFiles: ["./src/test/setup.ts"],
    // Keep CPU-heavy archive fixtures and jsdom suites from oversubscribing
    // four-core CI runners and starving Vitest's worker RPC channel.
    maxWorkers: 2,
    projects: [
      {
        extends: true,
        test: {
          name: "node",
          environment: "node",
          include: ["src/**/*.test.ts"],
        },
      },
      {
        extends: true,
        test: {
          name: "dom",
          environment: "jsdom",
          include: ["src/**/*.test.tsx"],
        },
      },
    ],
    coverage: {
      provider: "v8",
      reporter: ["text", "text-summary", "html", "json-summary"],
      reportsDirectory: "./coverage",
      include: ["src/**/*.{ts,tsx}"],
      exclude: [
        "src/**/*.test.{ts,tsx}",
        "src/**/*.d.ts",
        "src/types/**",
        "src/scripts/**",
        "**/node_modules/**",
      ],
      thresholds: {
        statements: 63,
        branches: 78,
        functions: 82,
        lines: 63,
        "src/app/api/reports/**/share/route.ts": {
          branches: 80,
          lines: 90,
        },
        "src/app/api/share/**/route.ts": {
          branches: 80,
          lines: 90,
        },
        "src/app/api/cron/cleanup/route.ts": {
          branches: 90,
          lines: 95,
        },
        "src/app/api/analyze/route.ts": {
          branches: 80,
          lines: 85,
        },
        "src/lib/ingest{,Github,GithubTransport,Input,Workspace,Zip}.ts": {
          branches: 80,
          lines: 85,
        },
        "src/components/useReportActions.ts": {
          statements: 80,
          branches: 80,
          functions: 80,
        },
        "src/components/{InputForm,AnalysisIntentSelector,RepositoryInputControls,useAnalysisRequest,inputFormSupport}.{ts,tsx}": {
          branches: 80,
          lines: 90,
        },
        "src/components/InputForm.tsx": {
          branches: 80,
          lines: 90,
        },
        "src/components/CandidateBriefPanel.tsx": {
          branches: 80,
          lines: 85,
        },
        "src/components/ElkArchitectureGraph.tsx": {
          branches: 80,
          lines: 85,
        },
        "src/analyzer/packs/python{,/**}.ts": {
          branches: 80,
          lines: 85,
        },
        "src/analyzer/packs/tsjsResolve{,Compiler,Packages,Shared,Workspaces}.ts": {
          branches: 80,
          lines: 85,
        },
        "src/analyzer/packs/tsjsEntrypoints.ts": {
          branches: 80,
          lines: 85,
        },
        "src/analyzer/{index,analysisTypes,analysisDeadline,languagePacks,partialReport,reportAssembly,reportPersistence}.ts": {
          branches: 80,
          lines: 85,
        },
        "src/analyzer/scoring.ts": {
          branches: 80,
          lines: 85,
        },
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
