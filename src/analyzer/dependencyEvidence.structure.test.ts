import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const ANALYZER_DIR = path.join(process.cwd(), "src/analyzer");
const DEPENDENCY_EVIDENCE_DIR = path.join(ANALYZER_DIR, "dependencyEvidence");

function lineCount(filePath: string) {
  return fs.readFileSync(filePath, "utf8").split(/\r?\n/).length;
}

describe("dependency declaration evidence module structure", () => {
  it("keeps the facade and every focused production module at or below 300 lines", () => {
    const productionModules = [
      path.join(ANALYZER_DIR, "dependencyEvidence.ts"),
      ...fs
        .readdirSync(DEPENDENCY_EVIDENCE_DIR)
        .filter((fileName) => fileName.endsWith(".ts"))
        .map((fileName) => path.join(DEPENDENCY_EVIDENCE_DIR, fileName)),
    ];

    for (const modulePath of productionModules) {
      expect(
        lineCount(modulePath),
        `${path.relative(process.cwd(), modulePath)} exceeds 300 lines`
      ).toBeLessThanOrEqual(300);
    }
  });
});
