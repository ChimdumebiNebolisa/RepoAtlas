import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Report } from "@/types/report";
import { GET } from "./route";

const { getReportMock, exportReportToMarkdownMock } = vi.hoisted(() => ({
  getReportMock: vi.fn(),
  exportReportToMarkdownMock: vi.fn(),
}));

vi.mock("@/lib/storage", () => ({
  getReport: getReportMock,
}));

vi.mock("@/lib/export", () => ({
  exportReportToMarkdown: exportReportToMarkdownMock,
}));

const sampleReport: Report = {
  repo_metadata: {
    name: "repo-atlas",
    url: "https://github.com/example/repo-atlas",
    branch: "main",
    clone_hash: null,
    analyzed_at: "2026-03-25T00:00:00.000Z",
  },
  folder_map: {
    path: "src",
    type: "dir",
    children: [{ path: "src/index.ts", type: "file" }],
  },
  architecture: {
    nodes: [],
    edges: [],
  },
  start_here: [],
  danger_zones: [],
  run_commands: [],
  contribute_signals: {
    key_docs: [],
    ci_configs: [],
  },
  warnings: [],
};

describe("GET /api/reports/[id]/export/md", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns markdown with attachment headers when report exists", async () => {
    getReportMock.mockResolvedValue(sampleReport);
    exportReportToMarkdownMock.mockReturnValue("# Repo Brief\n");

    const response = await GET(new Request("http://localhost") as any, {
      params: { id: "report_123" },
    });

    expect(response.status).toBe(200);
    expect(await response.text()).toBe("# Repo Brief\n");
    expect(response.headers.get("Content-Type")).toBe(
      "text/markdown; charset=utf-8"
    );
    expect(response.headers.get("Content-Disposition")).toBe(
      'attachment; filename="repo-brief-report_123.md"'
    );
    expect(getReportMock).toHaveBeenCalledWith("report_123");
    expect(exportReportToMarkdownMock).toHaveBeenCalledWith(sampleReport);
  });

  it("returns 404 when report does not exist", async () => {
    getReportMock.mockResolvedValue(null);

    const response = await GET(new Request("http://localhost") as any, {
      params: { id: "missing-report" },
    });

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      code: "REPORT_NOT_FOUND",
      message: "Report not found.",
    });
    expect(exportReportToMarkdownMock).not.toHaveBeenCalled();
  });

  it("returns 400 for malformed report id", async () => {
    const response = await GET(new Request("http://localhost") as any, {
      params: { id: "bad/id" },
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      code: "INVALID_INPUT",
      message: "Invalid report id.",
    });
    expect(getReportMock).not.toHaveBeenCalled();
  });

  it("returns structured error payload for unexpected exceptions", async () => {
    getReportMock.mockRejectedValue(new Error("boom"));

    const response = await GET(new Request("http://localhost") as any, {
      params: { id: "report_123" },
    });

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      code: "ANALYSIS_FAILED",
      message: "Analysis failed. Check server logs.",
    });
  });
});
