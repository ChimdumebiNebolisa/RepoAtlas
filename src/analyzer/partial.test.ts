import { describe, expect, it, vi } from "vitest";
import path from "path";
import { analyzeRepository } from "./index";
import { AppError } from "@/lib/errors";

describe("analyzeRepository partial reports", () => {
  const fixturePath = path.resolve(__dirname, "../../fixtures/repo-ts");

  it("returns a partial report when deadline expires immediately after indexing", async () => {
    const consoleWarn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const result = await analyzeRepository(
      { zipRef: fixturePath },
      { deadlineMs: 0, requestId: "safe-request-id" }
    );

    expect(result.report.partial).toBe(true);
    expect(result.report.folder_map).toBeDefined();
    expect(result.report.warnings.some((w) => w.includes("partial report"))).toBe(true);
    expect(result.report.candidate_brief).toBeDefined();
    expect(consoleWarn).toHaveBeenCalledWith(
      JSON.stringify({
        level: "warn",
        event: "analysis_timeout",
        code: "TIMEOUT",
        outcome: "partial_report",
        requestId: "safe-request-id",
      })
    );
  }, 30000);

  it("returns a bounded timeout error when the deadline has already expired", async () => {
    const controller = new AbortController();
    controller.abort();

    const result = analyzeRepository(
      { zipRef: fixturePath },
      { signal: controller.signal }
    );

    await expect(result).rejects.toBeInstanceOf(AppError);
    await expect(result).rejects.toMatchObject({ code: "TIMEOUT", status: 504 });
  });
});
