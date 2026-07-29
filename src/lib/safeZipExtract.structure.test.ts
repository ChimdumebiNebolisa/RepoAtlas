import fs from "fs";
import path from "path";
import { describe, expect, it } from "vitest";

const MODULES = [
  "safeZipExtract.ts",
  "safeZipPlan.ts",
  "safeZipValidation.ts",
  "safeZipWrite.ts",
];

describe("safe ZIP extraction structure", () => {
  it("keeps the facade and focused production modules at or below 300 lines", () => {
    for (const moduleName of MODULES) {
      const source = fs.readFileSync(path.join(__dirname, moduleName), "utf8");
      expect(source.split(/\r?\n/).length, moduleName).toBeLessThanOrEqual(300);
    }
  });
});
