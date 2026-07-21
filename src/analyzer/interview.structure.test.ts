import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("Candidate Brief generator boundaries", () => {
  it("keeps the orchestrator and extracted modules below 500 lines", () => {
    const analyzerDir = path.resolve(__dirname);
    const moduleDir = path.join(analyzerDir, "interview");
    const modules = [
      path.join(analyzerDir, "interview.ts"),
      ...readdirSync(moduleDir)
        .filter((file) => file.endsWith(".ts"))
        .map((file) => path.join(moduleDir, file)),
    ];

    for (const modulePath of modules) {
      const lineCount = readFileSync(modulePath, "utf8").split("\n").length;
      expect(lineCount, path.relative(analyzerDir, modulePath)).toBeLessThanOrEqual(
        500
      );
    }
  });
});
