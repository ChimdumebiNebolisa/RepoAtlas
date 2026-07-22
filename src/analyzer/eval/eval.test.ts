import { describe, expect, it } from "vitest";
import { computeSetMetrics, hitRate } from "./metrics";
import { evaluateFixture, loadGoldLabels } from "./runFixtureEval";

describe("eval metrics helpers", () => {
  it("computes precision, recall, and f1 for set overlap", () => {
    const metrics = computeSetMetrics(["a", "b", "c"], ["a", "b", "d"]);
    expect(metrics.true_positives).toBe(2);
    expect(metrics.false_positives).toBe(1);
    expect(metrics.false_negatives).toBe(1);
    expect(metrics.precision).toBeCloseTo(2 / 3);
    expect(metrics.recall).toBeCloseTo(2 / 3);
    expect(metrics.f1).toBeCloseTo(2 / 3);
  });

  it("treats empty expected and predicted sets as perfect agreement", () => {
    expect(computeSetMetrics([], []).f1).toBe(1);
    expect(hitRate([], [])).toBe(1);
  });
});

describe("analyzer evaluation suite (fixture gold labels)", () => {
  const goldLabels = loadGoldLabels();

  it("loads gold labels for the seeded fixtures", () => {
    expect(goldLabels.map((item) => item.fixture).sort()).toEqual([
      "repo-fastapi",
      "repo-java",
      "repo-java-maven",
      "repo-monorepo",
      "repo-node-api",
      "repo-python",
      "repo-ts",
    ]);
  });

  it.each(goldLabels.map((gold) => [gold.fixture, gold] as const))(
    "meets baseline accuracy floors for %s",
    async (_name, gold) => {
      const result = await evaluateFixture(gold);
      const hasKnownGaps = (gold.known_gaps?.length ?? 0) > 0;

      // Entrypoint detection is the most mature signal across packs.
      expect(result.entrypoints.precision).toBeGreaterThanOrEqual(0.8);
      expect(result.entrypoints.recall).toBeGreaterThanOrEqual(hasKnownGaps ? 0.5 : 0.8);

      // Command extraction should not invent labels outside the gold set.
      expect(result.run_commands.precision).toBeGreaterThanOrEqual(0.8);
      if (gold.run_commands.length > 0) {
        expect(result.run_commands.recall).toBeGreaterThanOrEqual(0.8);
      }

      // Onboarding files should appear in the Start Here shortlist.
      expect(result.onboarding_hit_rate).toBeGreaterThanOrEqual(0.66);

      // Edge floors stay honest about language depth gaps called out in known_gaps.
      if (!hasKnownGaps && gold.internal_edges.length > 0) {
        expect(result.internal_edges.recall).toBeGreaterThanOrEqual(0.8);
        expect(result.internal_edges.precision).toBeGreaterThanOrEqual(0.5);
      } else if (gold.internal_edges.length > 0) {
        // Track the gap without pretending parity: require partial signal only.
        expect(result.internal_edges.recall + result.internal_edges.precision).toBeGreaterThan(0);
      }

      if (gold.high_coupling_files.length > 0) {
        expect(result.high_coupling_hit_rate).toBeGreaterThanOrEqual(0.5);
      }
    },
    60_000
  );
});
