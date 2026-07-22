import { describe, expect, it } from "vitest";
import { validateReport, parseAndValidateReport } from "./reportSchema";
import { REPORT_VERSION } from "@/types/report";

const minimalReport = {
  report_version: REPORT_VERSION,
  repo_metadata: {
    name: "test",
    url: "zip",
    branch: "main",
    clone_hash: null,
    analyzed_at: new Date().toISOString(),
  },
  folder_map: { path: ".", type: "dir" as const, children: [] },
  architecture: { nodes: [], edges: [] },
  start_here: [],
  danger_zones: [],
  run_commands: [],
  contribute_signals: { key_docs: [], ci_configs: [] },
  warnings: [],
};

describe("reportSchema", () => {
  it("accepts a minimal valid report", () => {
    const result = validateReport(minimalReport);
    expect(result.ok).toBe(true);
  });

  it("rejects corrupt JSON shape", () => {
    expect(validateReport({ foo: "bar" }).ok).toBe(false);
    expect(validateReport(null).ok).toBe(false);
  });

  it("rejects incompatible future versions", () => {
    const result = validateReport({ ...minimalReport, report_version: REPORT_VERSION + 1 });
    expect(result).toEqual({ ok: false, reason: "incompatible" });
  });

  it("accepts only bounded analysis intents", () => {
    expect(validateReport({ ...minimalReport, analysis_intent: "bug" }).ok).toBe(true);
    expect(
      validateReport({ ...minimalReport, analysis_intent: "free-form issue text" })
    ).toEqual({ ok: false, reason: "corrupt" });
  });

  it("parses valid JSON text", () => {
    const result = parseAndValidateReport(JSON.stringify(minimalReport));
    expect(result.ok).toBe(true);
  });

  it("returns corrupt for invalid JSON text", () => {
    expect(parseAndValidateReport("{not json").ok).toBe(false);
  });

  it("accepts a valid optional semantic_graph", () => {
    const result = validateReport({
      ...minimalReport,
      semantic_graph: {
        version: 1,
        language: "typescript",
        adapter: "tsjs-typescript-compiler-api",
        nodes: [{ id: "file:src/a.ts", kind: "file", label: "src/a.ts" }],
        edges: [
          {
            id: "e1",
            from: "file:src/a.ts",
            to: "file:src/b.ts",
            specifier: "./b",
            kind: "import",
            resolution: "resolved_internal",
            evidence: { path: "src/a.ts", line_start: 1, line_end: 1 },
          },
        ],
        stats: {
          node_count: 1,
          edge_count: 1,
          resolved_internal: 1,
          resolved_external: 0,
          unresolved: 0,
          ignored: 0,
          entrypoint_count: 0,
        },
        warnings: [],
      },
    });
    expect(result.ok).toBe(true);
  });

  it("rejects a corrupt semantic_graph without accepting partial graph data", () => {
    const result = validateReport({
      ...minimalReport,
      semantic_graph: {
        version: 1,
        language: "typescript",
        adapter: "x",
        nodes: [],
        edges: [{ from: "file:a", specifier: "./b" }],
        stats: {},
        warnings: [],
      },
    });
    expect(result).toEqual({ ok: false, reason: "corrupt" });
  });

  it("rejects malformed start_here / danger_zones / architecture entries", () => {
    expect(
      validateReport({
        ...minimalReport,
        start_here: [{ path: "a.ts", score: "bad", explanation: "x" }],
      }).ok
    ).toBe(false);
    expect(
      validateReport({
        ...minimalReport,
        danger_zones: [{ path: "a.ts", score: 1, breakdown: "x", metrics: "nope" }],
      }).ok
    ).toBe(false);
    expect(
      validateReport({
        ...minimalReport,
        architecture: { nodes: [{ id: 1, label: "x" }], edges: [] },
      }).ok
    ).toBe(false);
    expect(
      validateReport({
        ...minimalReport,
        contribute_signals: { key_docs: "README.md", ci_configs: [] },
      }).ok
    ).toBe(false);
  });

  it("rejects corrupt candidate_brief and commit_insights when present", () => {
    expect(
      validateReport({
        ...minimalReport,
        candidate_brief: { repo_summary: { headline: "x" } },
      }).ok
    ).toBe(false);
    expect(
      validateReport({
        ...minimalReport,
        commit_insights: { mode: "mystery", recent_work_areas: [], high_churn_files: [], co_changed_pairs: [], evidence_refs: [] },
      }).ok
    ).toBe(false);
  });
});
