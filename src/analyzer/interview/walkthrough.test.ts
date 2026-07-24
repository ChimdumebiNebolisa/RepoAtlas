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
      "a URL host separator",
      "A".repeat(57),
      "<https://docs.example.com/guide>",
    ],
    [
      "a URL subdomain separator",
      "A".repeat(65),
      "<https://repo.example.dev/map>",
    ],
    [
      "URL query punctuation",
      "A".repeat(47),
      "<https://docs.example.com/guide?view=full>",
    ],
    [
      "an email domain separator",
      "A".repeat(54),
      "<candidate.guide@example.com>",
    ],
    [
      "an email local-part separator",
      "A".repeat(72),
      "<first.last+repo@example.dev>",
    ],
  ])(
    "does not split an angle-bracket autolink at %s",
    (_, prefix, autolink) => {
      const purpose = `${prefix} ${autolink} for repository interviews`;
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
        expect(passage).not.toContain("<");
        expect(passage).not.toContain(">");
      }
      expect(script?.two_minute.startsWith(script.thirty_second)).toBe(true);
      expect(script?.deep_technical.startsWith(script.two_minute)).toBe(true);
      expect(script?.evidence_refs).toEqual(["start-1", "arch-1"]);
      expect(purpose).toContain(autolink);
    }
  );

  it.each([
    [
      "a paired span",
      "A".repeat(61),
      "<span>repository guide</span>",
    ],
    [
      "a paired span with a safe class attribute",
      "A".repeat(53),
      '<span class="purpose">repository map</span>',
    ],
    [
      "a paired link with a relative href",
      "A".repeat(54),
      '<a href="docs/guide.md">repository guide</a>',
    ],
    [
      "a paired abbreviation with a title",
      "A".repeat(44),
      '<abbr title="Application Programming Interface">API</abbr>',
    ],
    [
      "nested paired strong and code tags",
      "A".repeat(55),
      "<strong><code>npm run verify</code></strong>",
    ],
  ])(
    "does not split raw inline HTML near %s at the purpose boundary",
    (_, prefix, html) => {
      const purpose = `${prefix} ${html} for repository interviews`;
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
        expect(passage).not.toContain("<");
        expect(passage).not.toContain(">");
      }
      expect(script?.two_minute.startsWith(script.thirty_second)).toBe(true);
      expect(script?.deep_technical.startsWith(script.two_minute)).toBe(true);
      expect(script?.evidence_refs).toEqual(["start-1", "arch-1"]);
      expect(purpose).toContain(html);
    }
  );

  it.each([
    [
      "a full reference label",
      "A".repeat(61),
      "[repository guide][guide-ref]",
    ],
    [
      "a collapsed reference label",
      "A".repeat(68),
      "[setup guide][]",
    ],
    [
      "an image reference label",
      "A".repeat(62),
      "![architecture overview][map-ref]",
    ],
    [
      "an emphasized reference label",
      "A".repeat(62),
      "[**risk parser**][risk-ref]",
    ],
    [
      "a hyphenated reference label",
      "A".repeat(61),
      "[first-PR small-fix guide][contribute-ref]",
    ],
  ])(
    "does not split %s at the purpose boundary",
    (_, prefix, link) => {
      const purpose = `${prefix} ${link} for repository interviews`;
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
        expect(passage).not.toContain("[");
        expect(passage).not.toContain("]");
      }
      expect(script?.two_minute.startsWith(script.thirty_second)).toBe(true);
      expect(script?.deep_technical.startsWith(script.two_minute)).toBe(true);
      expect(script?.evidence_refs).toEqual(["start-1", "arch-1"]);
      expect(purpose).toContain(link);
    }
  );

  it.each([
    [
      "one nested label",
      "A".repeat(61),
      "[repository [guide]](docs/guide.md)",
    ],
    [
      "two nested label levels",
      "A".repeat(63),
      "[setup [Node [LTS]]](docs/setup.md)",
    ],
    [
      "a nested image label",
      "A".repeat(54),
      "![architecture [overview]](docs/map.png)",
    ],
    [
      "adjacent nested labels",
      "A".repeat(59),
      "[risk [parser] [review]](docs/risk.md)",
    ],
    [
      "a hyphenated two-level label",
      "A".repeat(53),
      "[first PR [small-fix [guide]]](docs/contribute.md)",
    ],
  ])(
    "does not split a Markdown link with %s at the purpose boundary",
    (_, prefix, link) => {
      const script = buildWalkthroughScript(
        {
          ...baseInput,
          projectPurpose: {
            text: `${prefix} ${link} for repository interviews`,
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
        expect(passage).not.toContain("[");
        expect(passage).not.toContain("]");
      }
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

  it.each([
    [
      "a parenthesized filename",
      "A".repeat(38),
      "[repository guide](docs/guide_(advanced).md)",
    ],
    [
      "a parenthesized path segment",
      "A".repeat(47),
      "[architecture notes](docs/(core)/architecture.md)",
    ],
    [
      "two nested parenthesis levels",
      "A".repeat(37),
      "[setup reference](docs/setup_(node_(lts)).md)",
    ],
    [
      "adjacent nested parentheses",
      "A".repeat(44),
      "[risk review](docs/risk_(parser(v2)).md)",
    ],
    [
      "a hyphenated nested destination",
      "A".repeat(32),
      "[first PR guide](docs/contribute_(small-fixes).md)",
    ],
  ])(
    "does not split a Markdown link with %s at the purpose boundary",
    (_, prefix, link) => {
      const script = buildWalkthroughScript(
        {
          ...baseInput,
          projectPurpose: {
            text: `${prefix} ${link} for repository interviews`,
            source: "readme_intro",
            path: "README.md",
            extracted: true,
            evidence_refs: [],
          },
        },
        evidence
      );
      const introduction = `Documentation project: ${prefix}… Start at README.md`;

      expect(script?.thirty_second).toContain(introduction);
      expect(script?.two_minute).toContain(introduction);
      expect(script?.deep_technical).toContain(introduction);
      expect(script?.thirty_second).not.toContain("[");
      expect(script?.two_minute.startsWith(script.thirty_second)).toBe(true);
      expect(script?.deep_technical.startsWith(script.two_minute)).toBe(true);
      expect(script?.evidence_refs).toEqual(["start-1", "arch-1"]);
    }
  );
});
