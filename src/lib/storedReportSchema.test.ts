import { describe, expect, it } from "vitest";
import type { Report } from "@/types/report";
import {
  parseStoredReport,
  serializeStoredReport,
  STORED_REPORT_SCHEMA_VERSION,
} from "./storedReportSchema";

const minimalReport: Report = {
  repo_metadata: {
    name: "storage-schema-test",
    url: "zip",
    branch: "main",
    clone_hash: null,
    analyzed_at: "2026-07-20T12:00:00.000Z",
  },
  folder_map: { path: ".", type: "dir", children: [] },
  architecture: { nodes: [], edges: [] },
  start_here: [],
  danger_zones: [],
  run_commands: [],
  contribute_signals: { key_docs: [], ci_configs: [] },
  warnings: [],
};

describe("storedReportSchema", () => {
  it("writes the first explicit storage schema without changing the report", () => {
    const body = serializeStoredReport(minimalReport);

    expect(JSON.parse(body)).toEqual({
      storage_schema_version: STORED_REPORT_SCHEMA_VERSION,
      report: minimalReport,
    });
    expect(parseStoredReport(body)).toEqual({ ok: true, report: minimalReport });
  });

  it("migrates a valid current unversioned record deterministically", () => {
    const legacyBody = JSON.stringify(minimalReport);

    expect(parseStoredReport(legacyBody)).toEqual({ ok: true, report: minimalReport });
    expect(parseStoredReport(legacyBody)).toEqual(parseStoredReport(legacyBody));
  });

  it("rejects an unknown future storage version without returning stored content", () => {
    const result = parseStoredReport(
      JSON.stringify({
        storage_schema_version: STORED_REPORT_SCHEMA_VERSION + 1,
        report: { ...minimalReport, private_repository_detail: "do not leak" },
      })
    );

    expect(result).toEqual({ ok: false, reason: "incompatible" });
    expect(JSON.stringify(result)).not.toContain("do not leak");
  });

  it.each([
    { storage_schema_version: "1", report: minimalReport },
    { storage_schema_version: 0, report: minimalReport },
    { storage_schema_version: 1 },
    { storage_schema_version: 1, report: { private_repository_detail: "do not leak" } },
  ])("rejects malformed versioned records with a bounded result", (stored) => {
    const result = parseStoredReport(JSON.stringify(stored));

    expect(result).toEqual({ ok: false, reason: "corrupt" });
    expect(JSON.stringify(result)).not.toContain("do not leak");
  });

  it("refuses to serialize a malformed report without including its content", () => {
    expect(() =>
      serializeStoredReport({ private_repository_detail: "do not leak" } as unknown as Report)
    ).toThrow("Cannot store an invalid report.");
  });
});
