import { describe, expect, it } from "vitest";
import type { BuildCandidateBriefInput, EvidenceIndex } from "./types";
import { buildEvidenceIndex } from "./evidence";
import {
  buildAnalysisFocus,
  buildCandidateWarnings,
  buildReadingPath,
  buildRepoSummary,
  buildResumeBullets,
} from "./summary";

const baseInput: BuildCandidateBriefInput = {
  repoName: "summary-fixture",
  startHere: [
    {
      path: "README.md",
      score: 100,
      explanation: "Root documentation",
    },
  ],
  dangerZones: [
    {
      path: "src/risky.ts",
      score: 82,
      breakdown: "size and fan-out",
      metrics: {
        size: 900,
        fan_in: 3,
        fan_out: 5,
        complexity: 12,
        test_proximity: 0,
      },
    },
  ],
  runCommands: [
    {
      source: "package.json",
      command: "npm test",
      description: "test",
    },
  ],
  contributeSignals: {
    key_docs: ["README.md"],
    ci_configs: [".github/workflows/ci.yml"],
  },
  architecture: {
    nodes: [{ id: "src", label: "src", type: "folder" }],
    edges: [],
  },
  warnings: [],
};

function inputWith(
  overrides: Partial<BuildCandidateBriefInput> = {}
): BuildCandidateBriefInput {
  return {
    ...baseInput,
    ...overrides,
  };
}

function evidenceFor(input: BuildCandidateBriefInput): EvidenceIndex {
  return buildEvidenceIndex(input);
}

describe("repository summary boundary", () => {
  it("builds a complete evidence-bounded summary", () => {
    const input = inputWith({
      projectProfile: {
        type: "nextjs-app",
        label: "Next.js application",
        confidence: "high",
        signals: ["src/app/**/page.tsx"],
        evidence_refs: [],
      },
      projectPurpose: {
        text: "Maps a repository into an interview walkthrough.",
        source: "readme_intro",
        path: "README.md",
        extracted: true,
        evidence_refs: [],
      },
    });
    const evidence = evidenceFor(input);
    const summary = buildRepoSummary(input, evidence);

    expect(summary).toMatchObject({
      headline: "summary-fixture appears to be a Next.js application",
      plain_english:
        "Maps a repository into an interview walkthrough. (extracted from README.md). " +
        "RepoAtlas also found 1 reading candidates, 1 risk-ranked files, and 1 run commands.",
      confidence: "medium",
    });
    expect(summary.primary_evidence).toEqual([
      evidence.startHereRefs.get("README.md"),
      evidence.dangerZoneRefs.get("src/risky.ts"),
      evidence.architectureRef,
      evidence.commandRefs.get("package.json:npm test"),
      evidence.docRefs.get("README.md"),
    ]);
  });

  it("does not repeat an extracted purpose when its path has no report evidence", () => {
    const input = inputWith({
      startHere: [],
      dangerZones: [],
      runCommands: [],
      contributeSignals: { key_docs: [], ci_configs: [] },
      projectPurpose: {
        text: "Unsupported marketing claim.",
        source: "app_metadata",
        path: "src/missing.ts",
        extracted: true,
        evidence_refs: [],
      },
    });
    const summary = buildRepoSummary(input, evidenceFor(input));

    expect(summary.plain_english).not.toContain("Unsupported marketing claim");
    expect(summary.plain_english).toContain(
      "RepoAtlas found 0 reading candidates, 0 risk-ranked files, 0 run commands"
    );
  });

  it("uses the ranked path or bounded fallback when the project profile is missing", () => {
    const rankedInput = inputWith();
    const ranked = buildRepoSummary(rankedInput, evidenceFor(rankedInput));
    const sparseInput = inputWith({
      startHere: [],
      dangerZones: [],
      runCommands: [],
      contributeSignals: { key_docs: [], ci_configs: [] },
      architecture: { nodes: [], edges: [] },
    });
    const sparseEvidence = evidenceFor(sparseInput);
    const sparse = buildRepoSummary(sparseInput, sparseEvidence);

    expect(ranked.headline).toBe(
      "summary-fixture has a ranked reading path starting at README.md"
    );
    expect(sparse).toMatchObject({
      headline: "summary-fixture has limited deterministic onboarding signals",
      primary_evidence: [sparseEvidence.architectureRef],
      confidence: "low",
    });
  });

  it("lowers summary confidence for warning-heavy incomplete analysis", () => {
    const input = inputWith({
      runCommands: [],
      contributeSignals: { key_docs: [], ci_configs: [] },
      warnings: ["one", "two", "three", "four"],
    });

    expect(buildRepoSummary(input, evidenceFor(input)).confidence).toBe("low");
  });

  it("builds bounded alternate-focus steps from complete evidence", () => {
    for (const [analysisIntent, expectedLabel] of [
      ["bug", "Bug investigation"],
      ["planned_change", "Planned change"],
      ["pull_request", "Pull-request discussion"],
    ] as const) {
      const input = inputWith({ analysisIntent });
      const focus = buildAnalysisFocus(input, evidenceFor(input));

      expect(focus).toMatchObject({
        intent: analysisIntent,
        label: expectedLabel,
        review_steps: [
          { title: "Orient at README.md" },
          { title: "Inspect the structural hotspot at src/risky.ts" },
          { title: "Plan validation with npm test" },
        ],
      });
    }
  });

  it("keeps interview focus implicit and bounds sparse alternate-focus steps", () => {
    const interviewInput = inputWith({ analysisIntent: "interview" });
    expect(buildAnalysisFocus(interviewInput, evidenceFor(interviewInput))).toBeUndefined();

    const input = inputWith({
      analysisIntent: "bug",
      startHere: [],
      dangerZones: [],
      runCommands: [],
    });
    const evidence = evidenceFor(input);
    const focus = buildAnalysisFocus(input, evidence);

    expect(focus?.review_steps).toEqual([
      {
        title: "Orient from the architecture map",
        detail:
          "Use the detected architecture summary to establish what RepoAtlas can and cannot trace.",
        evidence_refs: [evidence.architectureRef],
      },
      {
        title: "Bound the structural risk",
        detail:
          "No danger-zone file was detected, so keep the discussion tied to architecture and confidence gaps.",
        evidence_refs: [evidence.architectureRef],
      },
      {
        title: "Name the missing validation step",
        detail:
          "No run command was detected, so confirm the repository's intended validation workflow before changing code.",
        evidence_refs: [evidence.architectureRef],
      },
    ]);
  });

  it("falls back to architecture evidence when alternate-focus maps are incomplete", () => {
    const input = inputWith({ analysisIntent: "planned_change" });
    const evidence = evidenceFor(input);
    evidence.startHereRefs.clear();
    evidence.dangerZoneRefs.clear();
    evidence.commandRefs.clear();

    expect(buildAnalysisFocus(input, evidence)?.review_steps).toEqual([
      expect.objectContaining({ evidence_refs: [evidence.architectureRef] }),
      expect.objectContaining({ evidence_refs: [evidence.architectureRef] }),
      expect.objectContaining({ evidence_refs: [evidence.architectureRef] }),
    ]);
  });

  it("keeps incomplete reading paths ordered and evidence-linked", () => {
    const input = inputWith({
      startHere: [
        ...baseInput.startHere,
        {
          path: "src\\app.ts",
          score: 80,
          explanation: "Application entry",
        },
      ],
    });
    const evidence = evidenceFor(input);
    evidence.startHereRefs.delete("src\\app.ts");

    expect(buildReadingPath(input, evidence)).toEqual([
      {
        order: 1,
        title: "README.md",
        path: "README.md",
        why: "Root documentation",
        evidence_refs: [evidence.startHereRefs.get("README.md")],
      },
      {
        order: 2,
        title: "app.ts",
        path: "src\\app.ts",
        why: "Application entry",
        evidence_refs: [evidence.startHereRefs.get("README.md")],
      },
    ]);
  });

  it("builds resume bullets and warning fallbacks without unsupported certainty", () => {
    const input = inputWith({
      startHere: [],
      dangerZones: [],
      runCommands: [],
      contributeSignals: { key_docs: [], ci_configs: [] },
      warnings: ["Partial analysis"],
    });
    const evidence = evidenceFor(input);
    evidence.warningRefs.length = 0;

    expect(buildResumeBullets(input, evidence)).toEqual([
      expect.objectContaining({
        audience: "resume",
        text: expect.stringContaining("0 reading candidates"),
      }),
      expect.objectContaining({
        audience: "linkedin",
        text: expect.stringContaining("1 architecture nodes"),
      }),
    ]);
    expect(buildCandidateWarnings(input, evidence)).toEqual([
      {
        message: "Partial analysis",
        evidence_refs: [evidence.architectureRef],
      },
      expect.objectContaining({ message: expect.stringContaining("No ranked reading path") }),
      expect.objectContaining({ message: expect.stringContaining("No danger-zone") }),
      expect.objectContaining({ message: expect.stringContaining("No run commands") }),
    ]);
  });
});
