import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const COMPONENT_DIR = path.join(process.cwd(), "src", "components");

function sourceLineCount(fileName: string) {
  return fs.readFileSync(path.join(COMPONENT_DIR, fileName), "utf8").split("\n").length;
}

describe("CandidateBriefPanel structure", () => {
  it("keeps the coordinator and customer-facing sections focused", () => {
    for (const fileName of [
      "CandidateBriefPanel.tsx",
      "CandidateBriefCoreSections.tsx",
      "CandidateBriefPreparationSections.tsx",
      "CandidateBriefSupportSections.tsx",
    ]) {
      expect(sourceLineCount(fileName), fileName).toBeLessThanOrEqual(300);
    }
  });
});
