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

  it("parses valid JSON text", () => {
    const result = parseAndValidateReport(JSON.stringify(minimalReport));
    expect(result.ok).toBe(true);
  });

  it("returns corrupt for invalid JSON text", () => {
    expect(parseAndValidateReport("{not json").ok).toBe(false);
  });
});
