/**
 * Isolated analysis worker host.
 * Spawns a worker thread for analyzeRepository; falls back in-process only when
 * the worker cannot be spawned (missing script / sandbox), not when analysis fails.
 */

import { Worker } from "node:worker_threads";
import fs from "fs";
import path from "path";
import { AppError, ERROR_CODES, type ErrorCode } from "@/lib/errors";
import {
  analyzeRepository,
  type AnalyzeInput,
  type AnalyzeOptions,
  type AnalyzeResult,
} from "./index";

export type IsolatedAnalyzeOptions = AnalyzeOptions & {
  /** Force in-process execution (also default under Vitest). */
  inline?: boolean;
};

type WorkerAppErrorPayload = {
  code: ErrorCode;
  status: number;
  message: string;
  expose?: boolean;
};

type WorkerMessage = {
  ready?: boolean;
  ok?: boolean;
  result?: AnalyzeResult;
  error?: string;
  appError?: WorkerAppErrorPayload;
};

function shouldRunInline(options?: IsolatedAnalyzeOptions): boolean {
  if (options?.inline) return true;
  if (process.env.ANALYZE_INLINE === "1") return true;
  if (process.env.VITEST) return true;
  if (process.env.ANALYZE_USE_WORKER === "0") return true;
  return false;
}

function workerScriptPath(): string {
  return path.join(/* turbopackIgnore: true */ process.cwd(), "scripts", "analysis-worker.cjs");
}

function isSpawnFailure(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const code = (error as NodeJS.ErrnoException).code;
  return (
    code === "ERR_WORKER_PATH" ||
    code === "ERR_WORKER_INVALID_EXEC_ARGV" ||
    code === "MODULE_NOT_FOUND" ||
    /Cannot find module|not a valid Worker/i.test(error.message)
  );
}

function timeoutError(): AppError {
  return new AppError({
    code: ERROR_CODES.TIMEOUT,
    status: 504,
    message: "Analysis timed out.",
  });
}

function errorFromWorkerMessage(message: WorkerMessage): Error {
  if (message.appError && typeof message.appError.code === "string") {
    const code = (Object.values(ERROR_CODES) as string[]).includes(message.appError.code)
      ? (message.appError.code as ErrorCode)
      : ERROR_CODES.ANALYSIS_FAILED;
    return new AppError({
      code,
      status: message.appError.status || 500,
      message: message.appError.message || message.error || "Worker analysis failed",
      expose: message.appError.expose ?? true,
    });
  }
  return new Error(message.error ?? "Worker analysis failed");
}

export async function runIsolatedAnalysis(
  input: AnalyzeInput,
  options: IsolatedAnalyzeOptions = {}
): Promise<AnalyzeResult> {
  if (shouldRunInline(options)) {
    return analyzeRepository(input, options);
  }

  const script = workerScriptPath();
  if (!fs.existsSync(/* turbopackIgnore: true */ script)) {
    return analyzeRepository(input, options);
  }

  let workerFallbackAllowed = false;
  try {
    return await new Promise<AnalyzeResult>((resolve, reject) => {
      let worker: Worker;
      try {
        worker = new Worker(script, {
          workerData: {
            input,
            options: {
              requestId: options.requestId,
              analysisIntent: options.analysisIntent,
              deadlineMs: options.deadlineMs,
              persist: options.persist,
              allowInlineFallback: options.allowInlineFallback,
            },
          },
        });
      } catch (error) {
        workerFallbackAllowed = isSpawnFailure(error);
        reject(error);
        return;
      }

      let settled = false;
      let workerReady = false;
      let hardTimer: ReturnType<typeof setTimeout> | undefined;
      const cleanup = () => {
        if (hardTimer) clearTimeout(hardTimer);
        options.signal?.removeEventListener("abort", onAbort);
      };
      const settle = (fn: () => void) => {
        if (settled) return;
        settled = true;
        cleanup();
        fn();
      };

      const onAbort = () => {
        settle(() => {
          void worker.terminate().catch(() => undefined);
          reject(timeoutError());
        });
      };
      options.signal?.addEventListener("abort", onAbort, { once: true });
      if (options.signal?.aborted) {
        onAbort();
        return;
      }

      const hardDeadlineMs = Math.max(1_000, (options.deadlineMs ?? 120_000) + 5_000);
      hardTimer = setTimeout(() => {
        settle(() => {
          void worker.terminate().catch(() => undefined);
          reject(timeoutError());
        });
      }, hardDeadlineMs);

      worker.on("message", (message: WorkerMessage) => {
        if (message.ready) {
          workerReady = true;
          return;
        }
        settle(() => {
          if (message.ok && message.result) {
            resolve(message.result);
            return;
          }
          const error = errorFromWorkerMessage(message);
          if (!workerReady && isSpawnFailure(error)) {
            workerFallbackAllowed = true;
          }
          reject(error);
        });
      });
      worker.on("error", (error) => {
        if (!workerReady && isSpawnFailure(error)) {
          workerFallbackAllowed = true;
        }
        settle(() => reject(error));
      });
      worker.on("exit", (code) => {
        settle(() => {
          reject(new Error(`Analysis worker exited with code ${code} before completing`));
        });
      });
    });
  } catch (error) {
    if (workerFallbackAllowed) {
      return analyzeRepository(input, options);
    }
    throw error;
  }
}
