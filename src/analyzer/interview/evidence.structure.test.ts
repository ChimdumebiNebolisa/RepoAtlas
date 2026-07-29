import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("Candidate Brief evidence module boundaries", () => {
  it("keeps every production evidence module at or below 300 lines", () => {
    const moduleNames = [
      "evidence.ts",
      "evidenceConfidence.ts",
      "evidenceIndex.ts",
      "evidenceReferences.ts",
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
