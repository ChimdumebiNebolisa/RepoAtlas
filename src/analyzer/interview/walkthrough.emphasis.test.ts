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

describe("single-delimiter walkthrough emphasis", () => {
  it.each([
    ["an asterisk phrase", "A".repeat(64), "*repository guide*"],
    ["an underscore phrase", "A".repeat(67), "_setup notes_"],
    [
      "a hyphenated asterisk phrase",
      "A".repeat(61),
      "*risk-parser review*",
    ],
    [
      "an underscore phrase with inline code",
      "A".repeat(62),
      "_run `npm test` first_",
    ],
    [
      "an asterisk phrase with punctuation",
      "A".repeat(58),
      "*first PR: small fix*",
    ],
  ])(
    "does not split emphasis near %s",
    (_, prefix, emphasis) => {
      const purpose = `${prefix} ${emphasis} for repository interviews`;
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
      const introduction = `Documentation project: ${prefix}… Start at README.md`;
      const passages = [
        script?.thirty_second,
        script?.two_minute,
        script?.deep_technical,
      ];

      for (const passage of passages) {
        expect(passage).toContain(introduction);
        expect(passage).not.toContain("*");
        expect(passage).not.toContain("_");
      }
      expect(script?.two_minute.startsWith(script.thirty_second)).toBe(true);
      expect(script?.deep_technical.startsWith(script.two_minute)).toBe(true);
      expect(script?.evidence_refs).toEqual(["start-1", "arch-1"]);
      expect(purpose).toContain(emphasis);
    }
  );
});
