import { afterEach, describe, expect, it, vi } from "vitest";
import { AppError, ERROR_CODES } from "@/lib/errors";

const mocks = vi.hoisted(() => ({
  analyzeRepository: vi.fn(),
}));

vi.mock("./index", () => ({
  analyzeRepository: mocks.analyzeRepository,
}));

import { runIsolatedAnalysis } from "./runIsolatedAnalysis";

describe("runIsolatedAnalysis", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    mocks.analyzeRepository.mockReset();
  });

  it("stays inline under Vitest and preserves AppError", async () => {
    mocks.analyzeRepository.mockRejectedValueOnce(
      new AppError({
        code: ERROR_CODES.ZIP_INVALID,
        status: 400,
        message: "Invalid or corrupted zip file.",
      })
    );

    await expect(
      runIsolatedAnalysis({ zipRef: "/tmp/x.zip" }, { inline: true })
    ).rejects.toMatchObject({
      code: ERROR_CODES.ZIP_INVALID,
      status: 400,
    });
  });
});
