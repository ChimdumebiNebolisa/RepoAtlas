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
        "src/lib/portableSharing.ts": {
          branches: 80,
          lines: 85,
        },
        "src/lib/productAnalytics.ts": {
          branches: 80,
          lines: 85,
        },
        "src/lib/bundledSample.ts": {
          functions: 100,
          lines: 100,
        },
        "src/lib/homepageSamplePreview.ts": {
          branches: 90,
          lines: 90,
        },
        "src/components/TrackedAnalysisLink.tsx": {
          functions: 100,
          lines: 100,
        },
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
        "src/app/report/**/page.tsx": {
          branches: 80,
          lines: 85,
        },
        "src/app/share/**/page.tsx": {
          branches: 80,
          lines: 85,
        },
        "src/lib/ingest{,Github,GithubTransport,Input,Workspace,Zip}.ts": {
          branches: 80,
          lines: 85,
        },
        "src/lib/reportSchema.ts": {
          branches: 80,
          lines: 85,
        },
        "src/lib/analysisCache.ts": {
          branches: 80,
          lines: 85,
        },
        "src/lib/upstashRateLimit.ts": {
          branches: 80,
          lines: 85,
        },
        "src/lib/configureAbuseControls.ts": {
          branches: 80,
          lines: 85,
        },
        "src/lib/sharing.ts": {
          branches: 80,
          lines: 85,
        },
        "src/lib/elkLayout.ts": {
          branches: 80,
          lines: 85,
        },
        "src/lib/exportNames.ts": {
          branches: 80,
          lines: 85,
        },
        "src/lib/ingestLimitsClient.ts": {
          branches: 100,
          lines: 100,
        },
        "src/components/useReportActions.ts": {
          statements: 80,
          branches: 80,
          functions: 80,
        },
        "src/components/{InputForm,AnalysisIntentSelector,RepositoryInputControls,useAnalysisRequest,inputFormSupport}.{ts,tsx}":
          {
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
        "src/components/CandidateBriefEvidence.tsx": {
          branches: 80,
          lines: 85,
        },
        "src/components/EvidenceLinks.tsx": {
          branches: 80,
          lines: 85,
        },
        "src/components/ElkArchitectureGraph.tsx": {
          branches: 80,
          lines: 85,
        },
        "src/components/{DeepAnalysisSection,DocumentsPanel,RunContributeSection,FolderMapTree,StartHereTable,DangerZonesTable,ReportOverview,ReportDocument}.tsx":
          {
            branches: 80,
            lines: 85,
          },
        "src/components/ReportActionViews.tsx": {
          branches: 80,
          lines: 85,
        },
        "src/components/ReportTabs.tsx": {
          branches: 80,
          lines: 85,
        },
        "src/components/HomePage.tsx": {
          branches: 80,
          lines: 85,
        },
        "src/components/HomepageProofSections.tsx": {
          branches: 80,
          lines: 85,
        },
        "src/analyzer/packs/python{,/**}.ts": {
          branches: 80,
          lines: 85,
        },
        "src/analyzer/packs/python/extract.ts": {
          branches: 85,
          lines: 90,
        },
        "src/analyzer/packs/python/imports.ts": {
          branches: 85,
          lines: 90,
        },
        "src/analyzer/packs/python/entrypoints.ts": {
          branches: 90,
          lines: 90,
        },
        "src/analyzer/packs/python/architecture.ts": {
          branches: 95,
          lines: 95,
        },
        "src/analyzer/packs/java{,Architecture,Metrics,Modules,Semantic,Shared,Sources}.ts":
          {
            branches: 80,
            lines: 85,
          },
        "src/analyzer/packs/javaSources.ts": {
          branches: 95,
          lines: 100,
        },
        "src/analyzer/packs/javaArchitecture.ts": {
          branches: 90,
          lines: 90,
        },
        "src/analyzer/packs/tsjsResolve{,Compiler,Packages,Shared,Workspaces}.ts":
          {
            branches: 80,
            lines: 85,
          },
        "src/analyzer/packs/tsjsResolveShared.ts": {
          branches: 90,
          lines: 90,
        },
        "src/analyzer/packs/tsjsResolvePackages.ts": {
          branches: 90,
          lines: 90,
        },
        "src/analyzer/packs/tsjsResolveCompiler.ts": {
          branches: 90,
          lines: 90,
        },
        "src/analyzer/packs/tsjsResolveWorkspaces.ts": {
          branches: 95,
          lines: 95,
        },
        "src/analyzer/packs/tsjsEntrypoints.ts": {
          branches: 80,
          lines: 85,
        },
        "src/analyzer/packs/tsjsExtract.ts": {
          branches: 95,
          lines: 90,
        },
        "src/analyzer/{index,analysisTypes,analysisDeadline,languagePacks,partialReport,reportAssembly,reportPersistence}.ts":
          {
            branches: 80,
            lines: 85,
          },
        "src/analyzer/scoring.ts": {
          branches: 80,
          lines: 85,
        },
        "src/analyzer/semanticGraph.ts": {
          branches: 90,
          lines: 85,
        },
        "src/analyzer/boundaries.ts": {
          branches: 95,
          lines: 95,
        },
        "src/analyzer/runIsolatedAnalysis.ts": {
          branches: 80,
          lines: 85,
        },
        "src/analyzer/projectType.ts": {
          branches: 80,
          lines: 85,
        },
        "src/analyzer/pipeline.ts": {
          branches: 80,
          lines: 85,
        },
        "src/analyzer/snippets.ts": {
          branches: 80,
          lines: 85,
        },
        "src/analyzer/gitHistory.ts": {
          branches: 80,
          lines: 85,
        },
        "src/analyzer/questions.ts": {
          branches: 80,
          lines: 85,
        },
        "src/analyzer/testInventory.ts": {
          branches: 80,
          lines: 85,
        },
        "src/analyzer/symbols.ts": {
          branches: 90,
          lines: 90,
        },
        "src/analyzer/docs.ts": {
          branches: 95,
          lines: 95,
        },
        "src/analyzer/purpose.ts": {
          branches: 90,
          lines: 90,
        },
        "src/analyzer/ignoreRules.ts": {
          branches: 80,
          lines: 85,
        },
        "src/analyzer/interview/summary.ts": {
          branches: 80,
          lines: 85,
        },
        "src/analyzer/interview/contribution.ts": {
          branches: 90,
          lines: 90,
        },
        "src/analyzer/interview/evidence.ts": {
          branches: 95,
          lines: 95,
        },
        "src/analyzer/commands/index.ts": {
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
