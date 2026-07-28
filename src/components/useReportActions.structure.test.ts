import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const COMPONENT_DIR = path.join(process.cwd(), "src", "components");

function sourceLineCount(fileName: string) {
  return fs.readFileSync(path.join(COMPONENT_DIR, fileName), "utf8").split("\n").length;
}

describe("useReportActions structure", () => {
  it("keeps action state, format exports, private sharing, and coordination focused", () => {
    for (const fileName of [
      "useReportActions.ts",
      "reportActionState.ts",
      "useReportFormatExports.ts",
      "reportExportRendering.ts",
      "usePrivateReportSharing.ts",
    ]) {
      expect(sourceLineCount(fileName), fileName).toBeLessThanOrEqual(300);
    }
  });
});
