import { describe, expect, it } from "vitest";
import { buildWalkthroughScript } from "./walkthrough";
import type { BuildCandidateBriefInput, EvidenceIndex } from "./types";

const baseInput: BuildCandidateBriefInput = {
  repoName: "example-repo",
  startHere: [
    {
      path: "README.md",
      score: 100,
      explanation: "root README documentation",
    },
  ],
  dangerZones: [],
  runCommands: [],
  contributeSignals: {
    key_docs: ["README.md"],
    ci_configs: [],
  },
  architecture: {
    nodes: [],
    edges: [],
  },
  warnings: [],
  projectProfile: {
    type: "docs",
    label: "Documentation project",
    confidence: "medium",
    signals: ["README.md"],
    evidence_refs: [],
  },
};

const evidence: EvidenceIndex = {
  refs: [],
  architectureRef: "arch-1",
  startHereRefs: new Map([["README.md", "start-1"]]),
  dangerZoneRefs: new Map(),
  commandRefs: new Map(),
  docRefs: new Map(),
  ciRefs: new Map(),
  warningRefs: [],
};

describe("buildWalkthroughScript", () => {
  it.each([
    ["a period", "Maps repository structure.", "Maps repository structure."],
    ["a question mark", "Maps repository structure?", "Maps repository structure?"],
    ["an exclamation mark", "Maps repository structure!", "Maps repository structure!"],
    ["no terminal punctuation", "Maps repository structure", "Maps repository structure."],
  ])(
    "uses one terminal mark when the repository purpose ends with %s",
    (_, purpose, expectedPurpose) => {
      const script = buildWalkthroughScript(
        {
          ...baseInput,
          projectPurpose: {
            text: purpose,
            source: "readme_intro",
            path: "README.md",
            extracted: true,
            evidence_refs: [],
          },
        },
        evidence
      );
      const introduction = `Documentation project: ${expectedPurpose} Start at README.md`;

      expect(script?.thirty_second).toContain(introduction);
      expect(script?.two_minute).toContain(introduction);
      expect(script?.deep_technical).toContain(introduction);
      expect(script?.two_minute.startsWith(script.thirty_second)).toBe(true);
      expect(script?.deep_technical.startsWith(script.two_minute)).toBe(true);
      expect(script?.evidence_refs).toEqual(["start-1", "arch-1"]);
    }
  );
});
