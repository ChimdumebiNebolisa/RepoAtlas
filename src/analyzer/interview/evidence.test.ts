import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { BuildCandidateBriefInput } from "./types";
import {
  basename,
  buildConfidenceAssessment,
  buildEvidenceIndex,
  confidenceFor,
  decisionsWithDirectEvidence,
  firstAvailableRef,
  listPaths,
  refValues,
} from "./evidence";

const temporaryDirectories: string[] = [];

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

function makeInput(
  overrides: Partial<BuildCandidateBriefInput> = {}
): BuildCandidateBriefInput {
  return {
    repoName: "evidence-fixture",
    startHere: [
      {
        path: "README.md",
        score: 90,
        explanation: "Root documentation",
      },
    ],
    dangerZones: [
      {
        path: "src/risky.ts",
        score: 80,
        breakdown: "size and fan-out",
        metrics: {
          size: 900,
          fan_in: 2,
          fan_out: 4,
          complexity: 10,
          test_proximity: 20,
        },
      },
    ],
    runCommands: [
      {
        source: "package.json",
        command: "npm test",
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
    warnings: ["One bounded warning."],
    ...overrides,
  };
}

function makeWorkspace(): string {
  const directory = fs.mkdtempSync(
    path.join(os.tmpdir(), "repo-atlas-evidence-")
  );
  temporaryDirectories.push(directory);
  fs.mkdirSync(path.join(directory, "src"), { recursive: true });
  fs.mkdirSync(path.join(directory, ".github", "workflows"), {
    recursive: true,
  });
  fs.writeFileSync(
    path.join(directory, "package.json"),
    '{\n  "dependencies": {\n    "next": "16.2.11"\n  }\n}\n'
  );
  fs.writeFileSync(path.join(directory, "README.md"), "# Evidence fixture\n");
  fs.writeFileSync(
    path.join(directory, "src", "risky.ts"),
    "export const risky = true;\n"
  );
  fs.writeFileSync(
    path.join(directory, ".github", "workflows", "ci.yml"),
    "name: ci\n"
  );
  return directory;
}

describe("Candidate Brief evidence assembly", () => {
  it("builds every evidence family in stable input order", () => {
    const input = makeInput({
      semanticGraph: {
        adapter: "tsjs",
        nodes: [],
        edges: [
          {
            id: "edge-internal",
            from: "src/app.ts",
            to: "src/lib.ts",
            specifier: "./lib",
            kind: "import",
            resolution: "resolved_internal",
            evidence: {
              path: "src/app.ts",
              line_start: 2,
              line_end: 2,
              snippet: 'import "./lib";',
            },
          },
          {
            id: "edge-external",
            from: "src/app.ts",
            to: undefined,
            specifier: "react",
            kind: "import",
            resolution: "resolved_external",
            evidence: {
              path: "src/app.ts",
              line_start: 3,
              line_end: 3,
              snippet: 'import "react";',
            },
          },
        ],
        stats: {
          node_count: 0,
          edge_count: 2,
          resolved_internal: 1,
          resolved_external: 1,
          unresolved: 0,
          ignored: 0,
          entrypoint_count: 0,
        },
        version: 1,
        language: "typescript",
        warnings: [],
      },
      technicalDecisionEvidence: [
        {
          id: "decision-package",
          kind: "decision",
          label: "Package manifest",
          path: "package.json",
        },
      ],
    });

    const evidence = buildEvidenceIndex(input);

    expect(evidence.refs.map((ref) => ref.id)).toEqual([
      "arch-1",
      "decision-package",
      "arch-2",
      "sem-1",
      "start-1",
      "risk-1",
      "cmd-1",
      "doc-1",
      "ci-1",
      "warn-1",
    ]);
    expect(evidence.startHereRefs.get("README.md")).toBe("start-1");
    expect(evidence.dangerZoneRefs.get("src/risky.ts")).toBe("risk-1");
    expect(evidence.commandRefs.get("package.json:npm test")).toBe("cmd-1");
    expect(evidence.docRefs.get("README.md")).toBe("doc-1");
    expect(evidence.ciRefs.get(".github/workflows/ci.yml")).toBe("ci-1");
    expect(evidence.warningRefs).toEqual(["warn-1"]);
  });

  it("rejects ambiguous, colliding, wrong-kind, and stale decision evidence", () => {
    const workspacePath = makeWorkspace();
    const input = makeInput({
      workspacePath,
      semanticGraph: {
        adapter: "tsjs",
        nodes: [],
        edges: [
          {
            id: "edge-internal",
            from: "src/app.ts",
            to: "src/lib.ts",
            specifier: "./lib",
            kind: "import",
            resolution: "resolved_internal",
            evidence: {
              path: "src/app.ts",
              line_start: 1,
              line_end: 1,
              snippet: 'import "./lib";',
            },
          },
        ],
        stats: {
          node_count: 0,
          edge_count: 1,
          resolved_internal: 1,
          resolved_external: 0,
          unresolved: 0,
          ignored: 0,
          entrypoint_count: 0,
        },
        version: 1,
        language: "typescript",
        warnings: [],
      },
      technicalDecisions: [
        {
          category: "framework",
          decision: "Ambiguous framework",
          signals: ["conflicting files"],
          evidence_refs: ["decision-shared"],
        },
        {
          category: "testing",
          decision: "Colliding test tool",
          signals: ["generated ID collision"],
          evidence_refs: ["sem-1"],
        },
        {
          category: "storage",
          decision: "Missing storage",
          signals: ["missing file"],
          evidence_refs: ["decision-missing"],
        },
        {
          category: "deployment",
          decision: "Fresh manifest choice",
          signals: ["package.json"],
          evidence_refs: ["decision-fresh"],
        },
        {
          category: "auth",
          decision: "Wrong-kind auth",
          signals: ["wrong kind"],
          evidence_refs: ["decision-wrong-kind"],
        },
      ],
      technicalDecisionEvidence: [
        {
          id: "decision-shared",
          kind: "decision",
          label: "First conflicting source",
          path: "package.json",
        },
        {
          id: "decision-shared",
          kind: "decision",
          label: "Second conflicting source",
          path: "README.md",
        },
        {
          id: "sem-1",
          kind: "decision",
          label: "Collides with generated semantic evidence",
          path: "package.json",
        },
        {
          id: "decision-missing",
          kind: "decision",
          label: "Missing source",
          path: "missing.json",
          line_start: 99,
          line_end: 99,
          snippet: "stale manifest content",
        },
        {
          id: "decision-fresh",
          kind: "decision",
          label: "Fresh source",
          path: "package.json",
          line_start: 99,
          line_end: 99,
          snippet: "stale manifest content",
        },
        {
          id: "decision-wrong-kind",
          kind: "architecture",
          label: "Wrong evidence kind",
          path: "package.json",
        },
      ],
    });

    const evidence = buildEvidenceIndex(input);
    const supportedDecisions = decisionsWithDirectEvidence(input, evidence);
    const fresh = evidence.refs.find((ref) => ref.id === "decision-fresh");

    expect(supportedDecisions.map((decision) => decision.decision)).toEqual([
      "Fresh manifest choice",
    ]);
    expect(evidence.refs.filter((ref) => ref.id === "decision-shared")).toEqual(
      []
    );
    expect(evidence.refs.filter((ref) => ref.id === "sem-1")).toHaveLength(1);
    expect(evidence.refs.find((ref) => ref.id === "sem-1")?.kind).toBe(
      "architecture"
    );
    expect(
      evidence.refs.find((ref) => ref.id === "decision-missing")
    ).toBeUndefined();
    expect(
      evidence.refs.find((ref) => ref.id === "decision-wrong-kind")
    ).toBeUndefined();
    expect(fresh).toMatchObject({
      kind: "decision",
      path: "package.json",
      line_start: 1,
      line_end: 5,
    });
    expect(fresh?.snippet).toContain('"next": "16.2.11"');
    expect(fresh?.snippet).not.toContain("stale manifest content");
  });

  it("accepts unique direct decision evidence when no workspace is available", () => {
    const input = makeInput({
      technicalDecisions: [
        {
          category: "framework",
          decision: "Next.js",
          signals: ["package.json"],
          evidence_refs: ["decision-package"],
        },
      ],
      technicalDecisionEvidence: [
        {
          id: "decision-package",
          kind: "decision",
          label: "Package manifest",
          path: "package.json",
        },
      ],
    });
    const evidence = buildEvidenceIndex(input);

    expect(decisionsWithDirectEvidence(input, evidence)).toEqual(
      input.technicalDecisions
    );
    expect(evidence.refs.find((ref) => ref.id === "decision-package")).toEqual(
      input.technicalDecisionEvidence?.[0]
    );
  });

  it("rejects mixed-kind duplicate IDs even if an index is mutated later", () => {
    const input = makeInput({
      technicalDecisions: [
        {
          category: "framework",
          decision: "Ambiguous framework",
          signals: ["package.json"],
          evidence_refs: ["decision-package"],
        },
      ],
      technicalDecisionEvidence: [
        {
          id: "decision-package",
          kind: "decision",
          label: "Package manifest",
          path: "package.json",
        },
      ],
    });
    const evidence = buildEvidenceIndex(input);
    evidence.refs.push({
      id: "decision-package",
      kind: "architecture",
      label: "Conflicting architecture record",
    });

    expect(decisionsWithDirectEvidence(input, evidence)).toEqual([]);
  });

  it("keeps sparse fallback selection and map limits deterministic", () => {
    const evidence = buildEvidenceIndex(
      makeInput({
        startHere: [],
        dangerZones: [],
        runCommands: [],
        contributeSignals: { key_docs: [], ci_configs: [] },
        warnings: [],
      })
    );

    expect(refValues(evidence.startHereRefs)).toEqual([]);
    expect(refValues(evidence.startHereRefs, 1)).toEqual([]);
    expect(firstAvailableRef(evidence)).toBe(evidence.architectureRef);
  });

  it("keeps helper fallbacks and confidence boundaries deterministic", () => {
    expect(basename("")).toBe("");
    expect(basename("src\\feature\\index.ts")).toBe("index.ts");
    expect(listPaths([], "No paths")).toBe("No paths");
    expect(listPaths(["README.md"], "No paths")).toBe("`README.md`");
    expect(listPaths(["README.md", "CONTRIBUTING.md"], "No paths")).toBe(
      "`README.md`, `CONTRIBUTING.md`"
    );

    const lowInput = makeInput({
      startHere: [],
      runCommands: [],
      contributeSignals: { key_docs: [], ci_configs: [] },
      architecture: { nodes: [], edges: [] },
      warnings: [],
    });
    expect(buildConfidenceAssessment(lowInput)).toEqual({
      level: "low",
      reasons: [],
      gaps: ["No README found", "No run commands detected", "No architecture edges"],
    });

    const mediumInput = makeInput({
      testInventory: {
        frameworks: [],
        test_file_count: 0,
        tested_areas: [],
        untested_high_risk_files: [],
        suggested_test_targets: [],
        evidence_refs: [],
      },
    });
    expect(confidenceFor(mediumInput)).toBe("medium");

    const highInput = makeInput({
      projectPurpose: {
        text: "Evidence-backed repository walkthroughs.",
        source: "readme_intro",
        path: "README.md",
        extracted: true,
        evidence_refs: [],
      },
      architecture: {
        nodes: [{ id: "src", label: "src", type: "folder" }],
        edges: [{ from: "src", to: "lib", type: "import" }],
      },
      testInventory: {
        frameworks: ["vitest"],
        test_file_count: 1,
        tested_areas: ["src/evidence.test.ts"],
        untested_high_risk_files: [],
        suggested_test_targets: [],
        evidence_refs: [],
      },
    });
    expect(buildConfidenceAssessment(highInput).level).toBe("high");
  });

  it("labels internal semantic edges without a resolved target deterministically", () => {
    const evidence = buildEvidenceIndex(
      makeInput({
        semanticGraph: {
          adapter: "tsjs",
          nodes: [],
          edges: [
            {
              id: "edge-missing",
              from: "src/app.ts",
              to: undefined,
              specifier: "./missing",
              kind: "import",
              resolution: "resolved_internal",
              evidence: {
                path: "src/app.ts",
                line_start: 4,
                line_end: 4,
                snippet: 'import "./missing";',
              },
            },
          ],
          stats: {
            node_count: 0,
            edge_count: 1,
            resolved_internal: 1,
            resolved_external: 0,
            unresolved: 0,
            ignored: 0,
            entrypoint_count: 0,
          },
          version: 1,
          language: "typescript",
          warnings: [],
        },
      })
    );

    expect(evidence.refs.find((ref) => ref.id === "sem-1")?.detail).toBe(
      "import → unknown"
    );
  });
});
