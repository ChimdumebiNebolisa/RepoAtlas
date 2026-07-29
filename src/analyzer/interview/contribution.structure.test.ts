import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("Candidate Brief contribution module boundaries", () => {
  it("keeps every production contribution module at or below 300 lines", () => {
    const moduleNames = [
      "contribution.ts",
      "contributionEvidence.ts",
      "contributionFirstPr.ts",
      "contributionImprovement.ts",
      "contributionFirstWeek.ts",
    ];

    for (const moduleName of moduleNames) {
      const source = fs.readFileSync(
        path.join(process.cwd(), "src/analyzer/interview", moduleName),
        "utf8"
      );
      expect(source.split(/\r?\n/).length, moduleName).toBeLessThanOrEqual(300);
    }
  });
});
