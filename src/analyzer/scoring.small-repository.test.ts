import { describe, expect, it } from "vitest";
import path from "path";
import expected from "../../fixtures/repo-small-danger-score/expected-danger-zones.json";
import { analyzeRepository } from "./index";

describe("small-repository Danger Zone calibration", () => {
  it("keeps one tested leaf below the structural-hotspot range", async () => {
    const fixturePath = path.resolve(
      __dirname,
      "../../fixtures/repo-small-danger-score"
    );
    const { report } = await analyzeRepository({ zipRef: fixturePath });

    expect(report.danger_zones.map((item) => item.path)).toEqual(
      expected.productionFiles
    );
    expect(
      report.danger_zones.some((item) =>
        expected.excludedTestFiles.includes(item.path)
      )
    ).toBe(false);

    const labeled = expected.dangerZones[0];
    const observed = report.danger_zones.find(
      (item) => item.path === labeled.path
    );
    expect(observed, labeled.meaning).toBeDefined();
    expect(observed?.score, labeled.meaning).toBeLessThanOrEqual(
      labeled.maximumScore
    );
  }, 30000);
});
