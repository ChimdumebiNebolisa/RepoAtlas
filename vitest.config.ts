import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    coverage: {
      provider: "v8",
      reporter: ["text", "text-summary", "html", "json-summary"],
      reportsDirectory: "./coverage",
      // Scope coverage to production source only. Foreign repository fixtures,
      // generated output, E2E specs, and type-only declarations are excluded
      // because they are not RepoAtlas production logic.
      include: ["src/**/*.{ts,tsx}"],
      exclude: [
        "src/**/*.test.{ts,tsx}",
        "src/**/*.d.ts",
        "src/types/**",
        "src/scripts/**",
        "**/node_modules/**",
      ],
      // Non-regression floor. The measured baseline (production src only) is
      // ~64% statements / ~80% branches; the gap is dominated by frontend
      // components that lack a DOM test environment. Raising the global target
      // to 80%/75% (behavior-level component tests under jsdom) is tracked in
      // docs/roadmap.md. These thresholds prevent regression below baseline.
      thresholds: {
        statements: 63,
        branches: 78,
        functions: 82,
        lines: 63,
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
