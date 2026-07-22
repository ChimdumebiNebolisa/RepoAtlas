import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppError, ERROR_CODES } from "@/lib/errors";
import type { Report } from "@/types/report";

const mocks = vi.hoisted(() => ({
  cleanup: vi.fn(),
  throwIfAborted: vi.fn(),
  isExpired: vi.fn(),
  ingestRepo: vi.fn(),
  runIndexingPipeline: vi.fn(),
  discoverDocuments: vi.fn(),
  runLanguagePacks: vi.fn(),
  combineArchitecture: vi.fn(),
  collectLanguageWarnings: vi.fn(),
  analyzeCommitInsights: vi.fn(),
  computeStartHere: vi.fn(),
  computeDangerZones: vi.fn(),
  buildPartialReport: vi.fn(),
  logPartialReport: vi.fn(),
  buildCompleteReport: vi.fn(),
  finishReport: vi.fn(),
}));

vi.mock("@/lib/ingest", () => ({ ingestRepo: mocks.ingestRepo }));
vi.mock("./analysisDeadline", () => ({
  createDeadlineChecker: () => ({
    throwIfAborted: mocks.throwIfAborted,
    isExpired: mocks.isExpired,
  }),
}));
vi.mock("./pipeline", () => ({ runIndexingPipeline: mocks.runIndexingPipeline }));
vi.mock("./docs", () => ({ discoverDocuments: mocks.discoverDocuments }));
vi.mock("./languagePacks", () => ({
  runLanguagePacks: mocks.runLanguagePacks,
  combineArchitecture: mocks.combineArchitecture,
  collectLanguageWarnings: mocks.collectLanguageWarnings,
}));
vi.mock("./gitHistory", () => ({ analyzeCommitInsights: mocks.analyzeCommitInsights }));
vi.mock("./scoring", () => ({
  computeStartHere: mocks.computeStartHere,
  computeDangerZones: mocks.computeDangerZones,
}));
vi.mock("./partialReport", () => ({
  buildPartialReport: mocks.buildPartialReport,
  logPartialReport: mocks.logPartialReport,
}));
vi.mock("./reportAssembly", () => ({ buildCompleteReport: mocks.buildCompleteReport }));
vi.mock("./reportPersistence", () => ({ finishReport: mocks.finishReport }));

import { analyzeRepository } from "./index";

const partialReport = { partial: true } as Report;
const completeReport = { partial: false } as Report;

beforeEach(() => {
  vi.clearAllMocks();
  mocks.ingestRepo.mockResolvedValue({
    path: "/tmp/repo",
    name: "repo",
    url: "zip",
    branch: null,
    cloneHash: null,
    cleanup: mocks.cleanup,
  });
  mocks.runIndexingPipeline.mockResolvedValue({
    file_metadata: new Map([["src/index.ts", {}]]),
    warnings: ["pipeline warning"],
  });
  mocks.discoverDocuments.mockReturnValue({ documents: [], duplicate_groups: [] });
  mocks.runLanguagePacks.mockReturnValue({
    tsjs: null,
    python: null,
    java: null,
    hasTsJsFiles: false,
    hasPythonFiles: false,
    hasJavaFiles: false,
  });
  mocks.combineArchitecture.mockReturnValue({ nodes: [], edges: [] });
  mocks.collectLanguageWarnings.mockReturnValue(["language warning"]);
  mocks.analyzeCommitInsights.mockResolvedValue({ mode: "unavailable" });
  mocks.computeStartHere.mockReturnValue([{ path: "README.md" }]);
  mocks.computeDangerZones.mockReturnValue([{ path: "src/index.ts" }]);
  mocks.buildPartialReport.mockReturnValue(partialReport);
  mocks.buildCompleteReport.mockReturnValue(completeReport);
  mocks.finishReport.mockImplementation(async (reportId, report, persist) => ({
    reportId,
    report,
    persisted: persist,
  }));
  mocks.isExpired.mockReturnValue(false);
});

describe("analysis coordination checkpoints", () => {
  it("returns the indexing-stage partial report", async () => {
    mocks.isExpired.mockReturnValueOnce(true);

    const result = await analyzeRepository({ zipRef: "/tmp/repo" });

    expect(result.report).toBe(partialReport);
    expect(mocks.runLanguagePacks).not.toHaveBeenCalled();
    expect(mocks.logPartialReport).toHaveBeenCalledOnce();
    expect(mocks.cleanup).toHaveBeenCalledOnce();
  });

  it("returns the language-pack-stage partial report", async () => {
    mocks.isExpired.mockReturnValueOnce(false).mockReturnValueOnce(true);

    await analyzeRepository({ zipRef: "/tmp/repo" });

    expect(mocks.buildPartialReport).toHaveBeenCalledWith(
      expect.objectContaining({
        architecture: { nodes: [], edges: [] },
        extraWarnings: ["language warning"],
      })
    );
    expect(mocks.analyzeCommitInsights).not.toHaveBeenCalled();
    expect(mocks.cleanup).toHaveBeenCalledOnce();
  });

  it("returns the scoring-stage partial report with commit warning", async () => {
    mocks.isExpired
      .mockReturnValueOnce(false)
      .mockReturnValueOnce(false)
      .mockReturnValueOnce(true);

    await analyzeRepository({ zipRef: "/tmp/repo" });

    expect(mocks.buildPartialReport).toHaveBeenCalledWith(
      expect.objectContaining({
        startHere: [{ path: "README.md" }],
        dangerZones: [{ path: "src/index.ts" }],
        extraWarnings: [
          "language warning",
          "Commit history unavailable for zip uploads without .git metadata.",
        ],
      })
    );
    expect(mocks.cleanup).toHaveBeenCalledOnce();
  });

  it("assembles and persists the complete report", async () => {
    const result = await analyzeRepository(
      { zipRef: "/tmp/repo" },
      { requestId: "safe-id", allowInlineFallback: true }
    );

    expect(result.report).toBe(completeReport);
    expect(mocks.buildCompleteReport).toHaveBeenCalledOnce();
    expect(mocks.finishReport).toHaveBeenCalledWith(
      expect.any(String),
      completeReport,
      true,
      true,
      "safe-id"
    );
    expect(mocks.cleanup).toHaveBeenCalledOnce();
  });

  it("passes ingested SHA and branch tip into commit history analysis", async () => {
    mocks.ingestRepo.mockResolvedValueOnce({
      path: "/tmp/repo",
      name: "repo",
      url: "https://github.com/example/sample-repo",
      branch: "feature/experiment",
      cloneHash: "deadbeefcafebabe",
      cleanup: mocks.cleanup,
    });

    await analyzeRepository({
      kind: "github",
      githubUrl: "https://github.com/example/sample-repo",
      ref: "feature/experiment",
    });

    expect(mocks.analyzeCommitInsights).toHaveBeenCalledWith("/tmp/repo", {
      githubUrl: "https://github.com/example/sample-repo",
      sha: "deadbeefcafebabe",
      ref: "feature/experiment",
    });
  });

  it("cleans up when cancellation is observed after ingestion", async () => {
    mocks.throwIfAborted.mockImplementationOnce(() => {
      throw new AppError({
        code: ERROR_CODES.TIMEOUT,
        status: 504,
        message: "Analysis timed out.",
      });
    });

    await expect(analyzeRepository({ zipRef: "/tmp/repo" })).rejects.toMatchObject({
      code: ERROR_CODES.TIMEOUT,
      status: 504,
    });
    expect(mocks.runIndexingPipeline).not.toHaveBeenCalled();
    expect(mocks.cleanup).toHaveBeenCalledOnce();
  });
});
