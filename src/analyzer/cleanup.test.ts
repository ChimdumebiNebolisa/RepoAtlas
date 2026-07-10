import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";

const { ingestRepoMock, saveReportMock, cleanupSpy } = vi.hoisted(() => ({
  ingestRepoMock: vi.fn(),
  saveReportMock: vi.fn(),
  cleanupSpy: vi.fn(),
}));

vi.mock("@/lib/ingest", () => ({ ingestRepo: ingestRepoMock }));
vi.mock("@/lib/storage", () => ({ saveReport: saveReportMock }));

import { analyzeRepository } from "./index";

let workspaceDir: string;

beforeEach(() => {
  workspaceDir = fs.mkdtempSync(path.join(os.tmpdir(), "cleanup-test-"));
  fs.writeFileSync(path.join(workspaceDir, "README.md"), "# Demo\n\nDemo repo.\n");
  fs.writeFileSync(
    path.join(workspaceDir, "package.json"),
    JSON.stringify({ name: "demo", scripts: { test: "vitest" } })
  );
  cleanupSpy.mockReset();
  ingestRepoMock.mockResolvedValue({
    path: workspaceDir,
    name: "demo",
    url: "zip",
    branch: null,
    cloneHash: null,
    cleanup: cleanupSpy,
  });
});

afterEach(() => {
  fs.rmSync(workspaceDir, { recursive: true, force: true });
  vi.clearAllMocks();
});

describe("analyzeRepository cleanup", () => {
  it("cleans up the workspace when report persistence fails", async () => {
    saveReportMock.mockRejectedValue(new Error("blob down"));

    await expect(analyzeRepository({ zipRef: workspaceDir })).rejects.toThrow(
      "blob down"
    );
    expect(cleanupSpy).toHaveBeenCalledTimes(1);
  }, 30000);

  it("cleans up the workspace on success", async () => {
    saveReportMock.mockResolvedValue(undefined);

    const result = await analyzeRepository({ zipRef: workspaceDir });
    expect(result.reportId).toBeDefined();
    expect(cleanupSpy).toHaveBeenCalledTimes(1);
  }, 30000);
});
