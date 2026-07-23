import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AppError, ERROR_CODES } from "@/lib/errors";
import type { AnalyzeResult } from "./index";

const mocks = vi.hoisted(() => ({
  analyzeRepository: vi.fn(),
  existsSync: vi.fn(),
  Worker: vi.fn(),
}));

vi.mock("./index", () => ({
  analyzeRepository: mocks.analyzeRepository,
}));

vi.mock("fs", () => ({
  default: {
    existsSync: mocks.existsSync,
  },
}));

vi.mock("node:worker_threads", () => ({
  Worker: mocks.Worker,
}));

import { runIsolatedAnalysis } from "./runIsolatedAnalysis";

type Listener = (...args: unknown[]) => void;

class ControlledWorker {
  private readonly listeners = new Map<string, Listener[]>();
  terminate = vi.fn<() => Promise<number>>().mockResolvedValue(0);

  on(event: string, listener: Listener): this {
    const listeners = this.listeners.get(event) ?? [];
    listeners.push(listener);
    this.listeners.set(event, listeners);
    return this;
  }

  emit(event: string, ...args: unknown[]): void {
    for (const listener of this.listeners.get(event) ?? []) {
      listener(...args);
    }
  }
}

const input = { zipRef: "/tmp/repository.zip" } as const;
const result = {
  reportId: "report-1",
  report: { repo_metadata: { name: "fixture" } },
  persisted: false,
} as AnalyzeResult;

function workerError(message: string, code?: string): Error {
  return Object.assign(new Error(message), code ? { code } : {});
}

function startWorker(
  options: Parameters<typeof runIsolatedAnalysis>[1] = {}
): { worker: ControlledWorker; promise: Promise<AnalyzeResult> } {
  const worker = new ControlledWorker();
  mocks.Worker.mockImplementationOnce(function workerFactory() {
    return worker;
  });
  return {
    worker,
    promise: runIsolatedAnalysis(input, options),
  };
}

describe("runIsolatedAnalysis", () => {
  beforeEach(() => {
    vi.stubEnv("VITEST", "");
    vi.stubEnv("ANALYZE_INLINE", "0");
    vi.stubEnv("ANALYZE_USE_WORKER", "1");
    mocks.existsSync.mockReturnValue(true);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
    mocks.analyzeRepository.mockReset();
    mocks.existsSync.mockReset();
    mocks.Worker.mockReset();
  });

  it.each([
    ["an explicit option", () => ({ inline: true })],
    [
      "the inline environment flag",
      () => {
        vi.stubEnv("ANALYZE_INLINE", "1");
        return {};
      },
    ],
    [
      "the Vitest environment flag",
      () => {
        vi.stubEnv("VITEST", "true");
        return {};
      },
    ],
    [
      "the disabled-worker flag",
      () => {
        vi.stubEnv("ANALYZE_USE_WORKER", "0");
        return {};
      },
    ],
  ])("runs inline for %s", async (_label, options) => {
    mocks.analyzeRepository.mockResolvedValueOnce(result);

    await expect(runIsolatedAnalysis(input, options())).resolves.toBe(result);

    expect(mocks.Worker).not.toHaveBeenCalled();
  });

  it("preserves an AppError from inline analysis", async () => {
    mocks.analyzeRepository.mockRejectedValueOnce(
      new AppError({
        code: ERROR_CODES.ZIP_INVALID,
        status: 400,
        message: "Invalid or corrupted zip file.",
      })
    );

    await expect(runIsolatedAnalysis(input, { inline: true })).rejects.toMatchObject({
      code: ERROR_CODES.ZIP_INVALID,
      status: 400,
    });
  });

  it("falls back inline when the worker script is missing", async () => {
    mocks.existsSync.mockReturnValueOnce(false);
    mocks.analyzeRepository.mockResolvedValueOnce(result);

    await expect(runIsolatedAnalysis(input)).resolves.toBe(result);

    expect(mocks.Worker).not.toHaveBeenCalled();
  });

  it.each([
    ["ERR_WORKER_PATH", "Invalid worker path"],
    ["ERR_WORKER_INVALID_EXEC_ARGV", "Invalid worker arguments"],
    ["MODULE_NOT_FOUND", "Worker module is missing"],
    [undefined, "Cannot find module analysis-worker.cjs"],
    [undefined, "not a valid Worker path"],
  ])("falls back for a recognized startup failure: %s %s", async (code, message) => {
    mocks.Worker.mockImplementationOnce(() => {
      throw workerError(message, code);
    });
    mocks.analyzeRepository.mockResolvedValueOnce(result);

    await expect(runIsolatedAnalysis(input)).resolves.toBe(result);

    expect(mocks.analyzeRepository).toHaveBeenCalledOnce();
  });

  it("propagates an unrecognized constructor failure without rerunning inline", async () => {
    const error = workerError("Unexpected worker constructor failure", "EACCES");
    mocks.Worker.mockImplementationOnce(() => {
      throw error;
    });

    await expect(runIsolatedAnalysis(input)).rejects.toBe(error);

    expect(mocks.analyzeRepository).not.toHaveBeenCalled();
  });

  it("passes only serializable worker options and resolves a worker result", async () => {
    vi.useFakeTimers();
    const controller = new AbortController();
    const { worker, promise } = startWorker({
      requestId: "request-1",
      analysisIntent: "interview",
      deadlineMs: 40_000,
      signal: controller.signal,
      persist: false,
      allowInlineFallback: true,
    });

    worker.emit("online");
    worker.emit("message", { ok: true, result });

    await expect(promise).resolves.toBe(result);
    expect(mocks.Worker).toHaveBeenCalledWith(
      expect.stringMatching(/scripts[/\\]analysis-worker\.cjs$/),
      {
        workerData: {
          input,
          options: {
            requestId: "request-1",
            analysisIntent: "interview",
            deadlineMs: 40_000,
            persist: false,
            allowInlineFallback: true,
          },
        },
      }
    );
    expect(vi.getTimerCount()).toBe(0);
  });

  it("reconstructs a structured AppError from the worker", async () => {
    const { worker, promise } = startWorker();

    worker.emit("message", {
      ok: false,
      error: "fallback message",
      appError: {
        code: ERROR_CODES.ZIP_INVALID,
        status: 422,
        message: "The archive is invalid.",
        expose: false,
      },
    });

    await expect(promise).rejects.toMatchObject({
      code: ERROR_CODES.ZIP_INVALID,
      status: 422,
      message: "The archive is invalid.",
      expose: false,
    });
  });

  it("bounds an unknown structured error code and missing fields", async () => {
    const { worker, promise } = startWorker();

    worker.emit("message", {
      ok: false,
      error: "Worker analysis failed safely.",
      appError: {
        code: "NOT_A_PUBLIC_ERROR",
        status: 0,
        message: "",
      },
    });

    await expect(promise).rejects.toMatchObject({
      code: ERROR_CODES.ANALYSIS_FAILED,
      status: 500,
      message: "Worker analysis failed safely.",
      expose: true,
    });
  });

  it.each([
    [{ ok: false, error: "Generic worker failure" }, "Generic worker failure"],
    [{ ok: true }, "Worker analysis failed"],
  ])("rejects a generic worker response: %j", async (message, expectedMessage) => {
    const { worker, promise } = startWorker();

    worker.emit("message", message);

    await expect(promise).rejects.toThrow(expectedMessage);
    expect(mocks.analyzeRepository).not.toHaveBeenCalled();
  });

  it("rejects an unexpected worker exit without rerunning inline", async () => {
    const { worker, promise } = startWorker();

    worker.emit("online");
    worker.emit("exit", 2);

    await expect(promise).rejects.toThrow(
      "Analysis worker exited with code 2 before completing"
    );
    expect(mocks.analyzeRepository).not.toHaveBeenCalled();
  });

  it("falls back for a recognized startup error emitted before online", async () => {
    mocks.analyzeRepository.mockResolvedValueOnce(result);
    const { worker, promise } = startWorker();

    worker.emit("error", workerError("Worker module is missing", "MODULE_NOT_FOUND"));

    await expect(promise).resolves.toBe(result);
    expect(mocks.analyzeRepository).toHaveBeenCalledOnce();
  });

  it("does not rerun inline for a worker failure after startup", async () => {
    const error = workerError("Cannot find module during analysis", "MODULE_NOT_FOUND");
    const { worker, promise } = startWorker();

    worker.emit("online");
    worker.emit("error", error);

    await expect(promise).rejects.toBe(error);
    expect(mocks.analyzeRepository).not.toHaveBeenCalled();
  });

  it("does not treat a generic terminated-worker error as a spawn failure", async () => {
    const error = new Error("Worker terminated while processing the repository");
    const { worker, promise } = startWorker();

    worker.emit("error", error);

    await expect(promise).rejects.toBe(error);
    expect(mocks.analyzeRepository).not.toHaveBeenCalled();
  });

  it("rejects an abort immediately even when termination never settles", async () => {
    const controller = new AbortController();
    const { worker, promise } = startWorker({ signal: controller.signal });
    worker.terminate.mockReturnValue(new Promise<number>(() => undefined));

    controller.abort();

    await expect(promise).rejects.toMatchObject({
      code: ERROR_CODES.TIMEOUT,
      status: 504,
      message: "Analysis timed out.",
    });
    expect(worker.terminate).toHaveBeenCalledOnce();
  });

  it("handles a signal that was already aborted", async () => {
    const controller = new AbortController();
    controller.abort();
    const { worker, promise } = startWorker({ signal: controller.signal });

    await expect(promise).rejects.toMatchObject({
      code: ERROR_CODES.TIMEOUT,
      status: 504,
    });
    expect(worker.terminate).toHaveBeenCalledOnce();
  });

  it("enforces the hard deadline without waiting for termination", async () => {
    vi.useFakeTimers();
    const { worker, promise } = startWorker({ deadlineMs: 10 });
    worker.terminate.mockReturnValue(new Promise<number>(() => undefined));
    const rejection = expect(promise).rejects.toMatchObject({
      code: ERROR_CODES.TIMEOUT,
      status: 504,
    });

    await vi.advanceTimersByTimeAsync(5_010);

    await rejection;
    expect(worker.terminate).toHaveBeenCalledOnce();
  });

  it("ignores late lifecycle events after a successful result", async () => {
    const { worker, promise } = startWorker();

    worker.emit("message", { ok: true, result });
    worker.emit("error", new Error("late error"));
    worker.emit("exit", 1);

    await expect(promise).resolves.toBe(result);
    expect(mocks.analyzeRepository).not.toHaveBeenCalled();
  });
});
