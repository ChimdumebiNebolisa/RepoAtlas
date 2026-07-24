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

  it.each([
    [
      "a word",
      "Builds evidence-linked Candidate Briefs for repository interviews and keeps every technical claim traceable.",
      "Builds evidence-linked Candidate Briefs for repository interviews and keeps…",
    ],
    [
      "terminal punctuation",
      `${"A".repeat(78)}. More evidence follows.`,
      `${"A".repeat(78)}.`,
    ],
    [
      "a terminal ellipsis",
      `${"A".repeat(79)}… More evidence follows.`,
      `${"A".repeat(79)}…`,
    ],
    [
      "boundary whitespace",
      `${"A".repeat(79)} next words continue beyond the limit`,
      `${"A".repeat(79)}…`,
    ],
    [
      "unbroken text",
      "A".repeat(100),
      undefined,
    ],
    [
      "a multibyte character",
      `${"A".repeat(70)} 🚀 ready for repository interviews with more evidence`,
      `${"A".repeat(70)} 🚀 ready…`,
    ],
    [
      "a joined emoji",
      `${"Maps files ".repeat(6)}for teams 👨‍👩‍👧‍👦 preparing repository interviews`,
      `${"Maps files ".repeat(6)}for teams…`,
    ],
    [
      "a combining mark",
      `${"A".repeat(78)} e\u0301 supports repository interviews with more evidence`,
      `${"A".repeat(78)}…`,
    ],
  ])(
    "shortens a long repository purpose safely near %s",
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
      const introduction = expectedPurpose
        ? `Documentation project: ${expectedPurpose} Start at README.md`
        : "Documentation project. Start at README.md";

      if (expectedPurpose) {
        expect(Array.from(expectedPurpose).length).toBeLessThanOrEqual(80);
      }
      expect(script?.thirty_second).toContain(introduction);
      expect(script?.two_minute).toContain(introduction);
      expect(script?.deep_technical).toContain(introduction);
      if (!expectedPurpose) {
        expect(script?.thirty_second).not.toContain("Documentation project:");
        expect(script?.thirty_second).not.toContain("A".repeat(79));
      }
      expect(script?.two_minute.startsWith(script.thirty_second)).toBe(true);
      expect(script?.deep_technical.startsWith(script.two_minute)).toBe(true);
      expect(script?.evidence_refs).toEqual(["start-1", "arch-1"]);
    }
  );

  it.each([
    [
      "a Markdown link",
      `${"Maps files ".repeat(4)}with a [repository guide](docs/guide.md) for interviews`,
      `${"Maps files ".repeat(4)}with a…`,
    ],
    [
      "inline code",
      `${"Maps files ".repeat(6)}with \`npm run verify\` before repository interviews`,
      `${"Maps files ".repeat(6)}with…`,
    ],
    [
      "emphasis",
      `${"Maps files ".repeat(6)}with **direct evidence** for repository interviews`,
      `${"Maps files ".repeat(6)}with…`,
    ],
  ])(
    "does not split %s at the purpose boundary",
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

      expect(Array.from(expectedPurpose).length).toBeLessThanOrEqual(80);
      expect(script?.thirty_second).toContain(introduction);
      expect(script?.two_minute).toContain(introduction);
      expect(script?.deep_technical).toContain(introduction);
      expect(script?.two_minute.startsWith(script.thirty_second)).toBe(true);
      expect(script?.deep_technical.startsWith(script.two_minute)).toBe(true);
      expect(script?.evidence_refs).toEqual(["start-1", "arch-1"]);
    }
  );
});
