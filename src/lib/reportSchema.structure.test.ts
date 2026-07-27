import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const LIB_DIR = path.join(process.cwd(), "src", "lib");

function sourceLineCount(fileName: string) {
  return fs.readFileSync(path.join(LIB_DIR, fileName), "utf8").split("\n").length;
}

describe("report schema structure", () => {
  it("keeps validation coordination and focused boundaries below 300 lines", () => {
    for (const fileName of [
      "reportSchema.ts",
      "reportSchemaPrimitives.ts",
      "reportSchemaFields.ts",
      "reportSchemaEvidence.ts",
      "reportSchemaArchitecture.ts",
      "reportSchemaCompatibility.ts",
    ]) {
      expect(sourceLineCount(fileName), fileName).toBeLessThanOrEqual(300);
    }
  });
});
