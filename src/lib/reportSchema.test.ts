import { describe, expect, it } from "vitest";
import { buildSampleReport } from "@/lib/buildSampleReport";
import { REPORT_VERSION } from "@/types/report";
import { parseAndValidateReport, validateReport } from "./reportSchema";

const minimalReport = {
  report_version: REPORT_VERSION,
  repo_metadata: {
    name: "test",
    url: "zip",
    branch: "main",
    clone_hash: null,
    analyzed_at: "2026-07-23T00:00:00.000Z",
  },
  folder_map: { path: ".", type: "dir" as const, children: [] },
  architecture: { nodes: [], edges: [] },
  start_here: [],
  danger_zones: [],
  run_commands: [],
  contribute_signals: { key_docs: [], ci_configs: [] },
  warnings: [],
};

const semanticGraph = {
  version: 1,
  language: "typescript",
  adapter: "tsjs-typescript-compiler-api",
  nodes: [
    {
      id: "file:src/a.ts",
      kind: "file",
      label: "src/a.ts",
      language: "typescript",
      entrypoint_reason: "manifest target",
    },
  ],
  edges: [
    {
      id: "e1",
      from: "file:src/a.ts",
      to: "file:src/b.ts",
      specifier: "./b",
      kind: "import",
      resolution: "resolved_internal",
      evidence: {
        path: "src/a.ts",
        line_start: 1,
        line_end: 1,
        snippet: "import './b'",
      },
      reason: "relative import",
      type_only: false,
    },
  ],
  stats: {
    node_count: 1,
    edge_count: 1,
    resolved_internal: 1,
    resolved_external: 0,
    unresolved: 0,
    ignored: 0,
    entrypoint_count: 1,
  },
  warnings: [],
};

function expectCorrupt(value: unknown) {
  expect(validateReport(value)).toEqual({ ok: false, reason: "corrupt" });
}

function mutableCandidate() {
  const report = structuredClone(buildSampleReport());
  report.report_version = REPORT_VERSION;
  return {
    report,
    candidate: report.candidate_brief as unknown as Record<string, unknown>,
  };
}

describe("reportSchema", () => {
  it("accepts complete, partial, and unversioned legacy reports", () => {
    const complete = buildSampleReport();
    complete.report_version = REPORT_VERSION;
    expect(validateReport(complete).ok).toBe(true);
    expect(validateReport({ ...minimalReport, partial: true }).ok).toBe(true);

    const { report_version: _version, ...legacy } = minimalReport;
    expect(validateReport(legacy).ok).toBe(true);
  });

  it("distinguishes incompatible versions from malformed versions", () => {
    expect(
      validateReport({ ...minimalReport, report_version: REPORT_VERSION + 1 }),
    ).toEqual({
      ok: false,
      reason: "incompatible",
    });
    for (const report_version of [
      "3",
      Number.NaN,
      Number.POSITIVE_INFINITY,
      0,
      2.5,
    ]) {
      expectCorrupt({ ...minimalReport, report_version });
    }
  });

  it("accepts only bounded analysis intents and booleans for partial reports", () => {
    for (const analysis_intent of [
      "interview",
      "bug",
      "planned_change",
      "pull_request",
    ]) {
      expect(validateReport({ ...minimalReport, analysis_intent }).ok).toBe(
        true,
      );
    }
    expectCorrupt({
      ...minimalReport,
      analysis_intent: "free-form issue text",
    });
    expectCorrupt({ ...minimalReport, partial: "yes" });
  });

  it("parses valid JSON and fails closed on malformed JSON", () => {
    expect(parseAndValidateReport(JSON.stringify(minimalReport)).ok).toBe(true);
    expect(parseAndValidateReport("{not json")).toEqual({
      ok: false,
      reason: "corrupt",
    });
    expectCorrupt(null);
    expectCorrupt({ foo: "bar" });
  });

  it("validates every required top-level report collection", () => {
    expectCorrupt({
      ...minimalReport,
      repo_metadata: { name: "missing fields" },
    });
    expectCorrupt({
      ...minimalReport,
      folder_map: { path: ".", type: "link" },
    });
    expectCorrupt({ ...minimalReport, start_here: "not an array" });
    expectCorrupt({ ...minimalReport, danger_zones: "not an array" });
    expectCorrupt({ ...minimalReport, run_commands: "not an array" });
    expectCorrupt({
      ...minimalReport,
      contribute_signals: { key_docs: "README.md", ci_configs: [] },
    });
    expectCorrupt({ ...minimalReport, warnings: [1] });
    expectCorrupt({ ...minimalReport, architecture: [] });
  });

  it("validates report item details and optional fields", () => {
    expect(
      validateReport({
        ...minimalReport,
        folder_map: {
          path: ".",
          type: "dir",
          truncated: true,
          children: [{ path: "src/a.ts", type: "file" }],
        },
        architecture: {
          nodes: [{ id: "src", label: "src", type: "folder" }],
          edges: [{ from: "src", to: "tests", type: "dependency" }],
        },
        start_here: [{ path: "src/a.ts", score: 1, explanation: "entrypoint" }],
        danger_zones: [
          {
            path: "src/a.ts",
            score: 2,
            breakdown: "large",
            metrics: {
              size: 1,
              fan_in: 0,
              fan_out: 1,
              complexity: 2,
              test_proximity: 3,
              churn: 0,
            },
          },
        ],
        run_commands: [
          { source: "package.json", command: "npm test", description: "tests" },
        ],
      }).ok,
    ).toBe(true);

    expectCorrupt({
      ...minimalReport,
      folder_map: { path: ".", type: "dir", truncated: "yes" },
    });
    expectCorrupt({
      ...minimalReport,
      architecture: {
        nodes: [{ id: "a", label: "a", type: "service" }],
        edges: [],
      },
    });
    expectCorrupt({
      ...minimalReport,
      architecture: {
        nodes: [],
        edges: [{ from: "a", to: "b", type: "call" }],
      },
    });
    expectCorrupt({
      ...minimalReport,
      run_commands: [{ source: "README", command: "npm test", description: 1 }],
    });
  });

  it("rejects excessive or cyclic folder nesting without recursing the call stack", () => {
    let deeplyNested: Record<string, unknown> = { path: "leaf", type: "file" };
    for (let depth = 0; depth < 66; depth += 1) {
      deeplyNested = {
        path: `dir-${depth}`,
        type: "dir",
        children: [deeplyNested],
      };
    }
    expectCorrupt({ ...minimalReport, folder_map: deeplyNested });

    const cyclic: Record<string, unknown> = {
      path: ".",
      type: "dir",
      children: [],
    };
    (cyclic.children as unknown[]).push(cyclic);
    expectCorrupt({ ...minimalReport, folder_map: cyclic });
  });

  it("rejects non-finite report scores and metrics", () => {
    expectCorrupt({
      ...minimalReport,
      start_here: [{ path: "a.ts", score: Number.NaN, explanation: "x" }],
    });
    expectCorrupt({
      ...minimalReport,
      danger_zones: [
        { path: "a.ts", score: Infinity, breakdown: "x", metrics: {} },
      ],
    });
    expectCorrupt({
      ...minimalReport,
      danger_zones: [
        {
          path: "a.ts",
          score: 1,
          breakdown: "x",
          metrics: { complexity: Infinity },
        },
      ],
    });
  });

  it("accepts a complete Candidate Brief and rejects the previously accepted incomplete shape", () => {
    const { report } = mutableCandidate();
    expect(validateReport(report).ok).toBe(true);

    expectCorrupt({
      ...minimalReport,
      candidate_brief: {
        repo_summary: { headline: "x", confidence: "high" },
        reading_path: [{ order: Number.NaN, title: "x", path: "x" }],
        first_pr_plan: [],
      },
    });
  });

  it("validates every required Candidate Brief boundary", () => {
    const mutations: Array<(candidate: Record<string, unknown>) => void> = [
      (candidate) => {
        (candidate.repo_summary as Record<string, unknown>).plain_english = 1;
      },
      (candidate) => {
        (candidate.reading_path as Array<Record<string, unknown>>)[0].why =
          undefined;
      },
      (candidate) => {
        candidate.interview_talking_points = null;
      },
      (candidate) => {
        const talkingPoints = candidate.interview_talking_points as Record<
          string,
          unknown
        >;
        (talkingPoints.tradeoffs as Record<string, unknown>).confidence =
          "certain";
      },
      (candidate) => {
        (candidate.first_pr_plan as Array<Record<string, unknown>>)[0].risk =
          "critical";
      },
      (candidate) => {
        (
          candidate.resume_bullets as Array<Record<string, unknown>>
        )[0].audience = "portfolio";
      },
      (candidate) => {
        (candidate.evidence_refs as Array<Record<string, unknown>>)[0].kind =
          "url";
      },
      (candidate) => {
        candidate.warnings = [{ message: 1 }];
      },
    ];

    for (const mutate of mutations) {
      const { report, candidate } = mutableCandidate();
      mutate(candidate);
      expectCorrupt(report);
    }
  });

  it("validates finite Candidate Brief order and evidence locations", () => {
    const { report, candidate } = mutableCandidate();
    (candidate.reading_path as Array<Record<string, unknown>>)[0].order =
      Number.NaN;
    expectCorrupt(report);

    const withBadLine = mutableCandidate();
    (
      withBadLine.candidate.evidence_refs as Array<Record<string, unknown>>
    )[0].line_start = Infinity;
    expectCorrupt(withBadLine.report);
  });

  it("validates every optional Candidate Brief section", () => {
    const mutations: Array<(candidate: Record<string, unknown>) => void> = [
      (candidate) => {
        candidate.analysis_focus = {
          intent: "interview",
          label: "Interview",
          summary: "Prepare",
          review_steps: [],
          discussion_questions: [],
        };
      },
      (candidate) => {
        (candidate.confidence_assessment as Record<string, unknown>).reasons =
          "because";
      },
      (candidate) => {
        (
          candidate.walkthrough_script as Record<string, unknown>
        ).improvements_next = "later";
      },
      (candidate) => {
        (
          candidate.behavioral_hooks as Array<Record<string, unknown>>
        )[0].sufficient_evidence = "yes";
      },
      (candidate) => {
        (
          candidate.interview_questions as Array<Record<string, unknown>>
        )[0].generic = "yes";
      },
    ];

    for (const mutate of mutations) {
      const { report, candidate } = mutableCandidate();
      mutate(candidate);
      expectCorrupt(report);
    }
  });

  it("validates commit insight modes, pairs, and finite counts", () => {
    const valid = {
      mode: "local_git",
      recent_work_areas: ["src"],
      high_churn_files: ["src/a.ts"],
      co_changed_pairs: [{ files: ["src/a.ts", "src/b.ts"], count: 2 }],
      evidence_refs: ["commit-1"],
    };
    expect(
      validateReport({ ...minimalReport, commit_insights: valid }).ok,
    ).toBe(true);
    expectCorrupt({
      ...minimalReport,
      commit_insights: { ...valid, mode: "mystery" },
    });
    expectCorrupt({
      ...minimalReport,
      commit_insights: {
        ...valid,
        co_changed_pairs: [{ files: ["a"], count: 1 }],
      },
    });
    expectCorrupt({
      ...minimalReport,
      commit_insights: {
        ...valid,
        co_changed_pairs: [{ files: ["a", "b"], count: NaN }],
      },
    });
  });

  it("accepts a complete semantic graph", () => {
    expect(
      validateReport({ ...minimalReport, semantic_graph: semanticGraph }).ok,
    ).toBe(true);
  });

  it("rejects malformed semantic nodes, edges, enums, and non-finite counts", () => {
    expectCorrupt({
      ...minimalReport,
      semantic_graph: {
        ...semanticGraph,
        nodes: [{ id: "a", kind: "service", label: "a" }],
      },
    });
    expectCorrupt({
      ...minimalReport,
      semantic_graph: {
        ...semanticGraph,
        edges: [{ from: "file:a", specifier: "./b" }],
      },
    });
    expectCorrupt({
      ...minimalReport,
      semantic_graph: {
        ...semanticGraph,
        stats: { ...semanticGraph.stats, edge_count: Infinity },
      },
    });
    expectCorrupt({
      ...minimalReport,
      semantic_graph: {
        ...semanticGraph,
        edges: [
          {
            ...semanticGraph.edges[0],
            evidence: { path: "src/a.ts", line_start: NaN, line_end: 1 },
          },
        ],
      },
    });
  });
});
