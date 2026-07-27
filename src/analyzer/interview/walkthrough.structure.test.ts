import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("walkthrough module boundaries", () => {
  it("keeps every production walkthrough module at or below 300 lines", () => {
    const moduleNames = [
      "walkthrough.ts",
      "walkthroughBehavioral.ts",
      "walkthroughEvidence.ts",
      "walkthroughPurpose.ts",
      "walkthroughScript.ts",
      "walkthroughText.ts",
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
