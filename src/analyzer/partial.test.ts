import { describe, expect, it } from "vitest";
import path from "path";
import { analyzeRepository } from "./index";

describe("analyzeRepository partial reports", () => {
  const fixturePath = path.resolve(__dirname, "../../fixtures/repo-ts");

  it("returns a partial report when deadline expires immediately after indexing", async () => {
    const result = await analyzeRepository(
      { zipRef: fixturePath },
      { deadlineMs: 0 }
    );

    expect(result.report.partial).toBe(true);
    expect(result.report.folder_map).toBeDefined();
    expect(result.report.warnings.some((w) => w.includes("partial report"))).toBe(true);
    expect(result.report.candidate_brief).toBeDefined();
  }, 30000);
});
