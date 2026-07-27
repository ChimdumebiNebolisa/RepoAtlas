import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const COMPONENT_DIR = path.join(process.cwd(), "src", "components");

function sourceLineCount(fileName: string) {
  return fs.readFileSync(path.join(COMPONENT_DIR, fileName), "utf8").split("\n").length;
}

describe("ElkArchitectureGraph structure", () => {
  it("keeps layout, rendering, controls, evidence, and recovery focused", () => {
    for (const fileName of [
      "ElkArchitectureGraph.tsx",
      "ArchitectureGraphReady.tsx",
      "ArchitectureGraphCanvas.tsx",
      "ArchitectureGraphControls.tsx",
      "ArchitectureGraphEvidence.tsx",
      "ArchitectureGraphStates.tsx",
      "useArchitectureGraphLayout.ts",
    ]) {
      expect(sourceLineCount(fileName), fileName).toBeLessThanOrEqual(300);
    }
  });
});
