import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const COMPONENT_DIR = path.join(process.cwd(), "src", "components");

function sourceLineCount(fileName: string) {
  return fs.readFileSync(path.join(COMPONENT_DIR, fileName), "utf8").split("\n").length;
}

describe("InputForm structure", () => {
  it("keeps the form coordinator and extracted boundaries focused", () => {
    expect(sourceLineCount("InputForm.tsx")).toBeLessThanOrEqual(300);

    for (const fileName of [
      "AnalysisIntentSelector.tsx",
      "RepositoryInputControls.tsx",
      "inputFormSupport.ts",
      "useAnalysisRequest.ts",
    ]) {
      expect(sourceLineCount(fileName), fileName).toBeLessThanOrEqual(350);
    }
  });
});
