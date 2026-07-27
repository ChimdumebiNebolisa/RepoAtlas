import fs from "fs";
import path from "path";
import { describe, expect, it } from "vitest";

const SCORING_DIR = path.join(process.cwd(), "src/analyzer/scoring");

describe("scoring module boundaries", () => {
  it("keeps the facade and every focused production module at or below 300 lines", () => {
    const modules = [
      path.join(process.cwd(), "src/analyzer/scoring.ts"),
      ...fs
        .readdirSync(SCORING_DIR)
        .filter((fileName) => fileName.endsWith(".ts"))
        .map((fileName) => path.join(SCORING_DIR, fileName)),
    ];

    for (const modulePath of modules) {
      const source = fs.readFileSync(modulePath, "utf8");
      expect(source.split(/\r?\n/).length, path.basename(modulePath)).toBeLessThanOrEqual(300);
    }
  });
});
