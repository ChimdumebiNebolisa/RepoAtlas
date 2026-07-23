import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  analyzeRepository: vi.fn(),
}));

vi.mock("@/analyzer", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/analyzer")>()),
  analyzeRepository: mocks.analyzeRepository,
}));

import { analyzeBundledSample, bundledSampleInput } from "./bundledSample";

const analysisResult = {
  reportId: "sample-report",
  report: { repo_metadata: { name: "repo-ts" } },
  persisted: false,
};

beforeEach(() => {
  mocks.analyzeRepository.mockReset();
  mocks.analyzeRepository.mockResolvedValue(analysisResult);
});

describe("bundled sample entrance", () => {
  it("keeps the established private sample repository input", () => {
    expect(bundledSampleInput()).toEqual({
      kind: "zip",
      zipRef: path.join(process.cwd(), "fixtures", "repo-ts"),
      zipName: "repo-ts",
    });
  });

  it("analyzes the sample for an interview without persistence", async () => {
    await expect(analyzeBundledSample()).resolves.toBe(analysisResult);

    expect(mocks.analyzeRepository).toHaveBeenCalledOnce();
    expect(mocks.analyzeRepository).toHaveBeenCalledWith(bundledSampleInput(), {
      analysisIntent: "interview",
      persist: false,
    });
  });

  it("forwards operational controls without weakening the sample contract", async () => {
    const controller = new AbortController();

    await analyzeBundledSample({
      requestId: "sample-request",
      deadlineMs: 12_345,
      signal: controller.signal,
      allowInlineFallback: true,
      analysisIntent: "bug",
      persist: true,
    });

    expect(mocks.analyzeRepository).toHaveBeenCalledWith(bundledSampleInput(), {
      requestId: "sample-request",
      deadlineMs: 12_345,
      signal: controller.signal,
      allowInlineFallback: true,
      analysisIntent: "interview",
      persist: false,
    });
  });
});
