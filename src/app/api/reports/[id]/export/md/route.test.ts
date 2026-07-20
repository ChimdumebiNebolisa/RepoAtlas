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
  const validId = "550e8400-e29b-41d4-a716-446655440000";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns markdown with attachment headers when report exists", async () => {
    getReportMock.mockResolvedValue(sampleReport);
    exportReportToMarkdownMock.mockReturnValue("# Repo Analysis\n");

    const response = await GET(new Request("http://localhost") as any, {
      params: Promise.resolve({ id: validId }),
    });

    expect(response.status).toBe(200);
    expect(await response.text()).toBe("# Repo Analysis\n");
    expect(response.headers.get("Content-Type")).toBe(
      "text/markdown; charset=utf-8"
    );
    expect(response.headers.get("Content-Disposition")).toBe(
      `attachment; filename="repoatlas-candidate-brief-repo-atlas-2026-03-25.md"`
    );
    expect(getReportMock).toHaveBeenCalledWith(validId);
    expect(exportReportToMarkdownMock).toHaveBeenCalledWith(sampleReport);
  });

  it("returns 404 when report does not exist", async () => {
    getReportMock.mockResolvedValue(null);

    const response = await GET(new Request("http://localhost") as any, {
      params: Promise.resolve({ id: validId }),
    });

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      code: "NOT_FOUND",
      message: "Report not found.",
    });
    expect(exportReportToMarkdownMock).not.toHaveBeenCalled();
  });

  it("returns 400 for malformed report id", async () => {
    const response = await GET(new Request("http://localhost") as any, {
      params: Promise.resolve({ id: "bad/id" }),
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
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);

    const response = await GET(new Request("http://localhost") as any, {
      params: Promise.resolve({ id: validId }),
    });

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      code: "ANALYSIS_FAILED",
      message: "Analysis failed. Check server logs.",
      requestId: expect.stringMatching(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
      ),
    });
    expect(consoleError).toHaveBeenCalledOnce();
    const logLine = String(consoleError.mock.calls[0]?.[0]);
    expect(logLine).toContain('"event":"report_export_failed"');
    expect(logLine).not.toContain(validId);
  });
});
