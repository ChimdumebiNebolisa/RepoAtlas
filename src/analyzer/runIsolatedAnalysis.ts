/**
 * Isolated analysis worker host.
 * Spawns a worker thread for analyzeRepository; falls back in-process only when
 * the worker cannot be spawned (missing script / sandbox), not when analysis fails.
 */

import { Worker } from "node:worker_threads";
import fs from "fs";
import path from "path";
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
    /Cannot find module|not a valid Worker|Worker terminated/i.test(error.message)
  );
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

  let spawnFailed = false;
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
        spawnFailed = true;
        reject(error);
        return;
      }

      let settled = false;
      const settle = (fn: () => void) => {
        if (settled) return;
        settled = true;
        fn();
      };

      const onAbort = () => {
        settle(() => {
          void worker.terminate().finally(() => {
            reject(new Error("Analysis worker aborted"));
          });
        });
      };
      options.signal?.addEventListener("abort", onAbort, { once: true });
      if (options.signal?.aborted) {
        onAbort();
        return;
      }

      const hardDeadlineMs = Math.max(1_000, (options.deadlineMs ?? 120_000) + 5_000);
      const hardTimer = setTimeout(() => {
        settle(() => {
          void worker.terminate().finally(() => {
            reject(new Error("Analysis worker exceeded hard deadline"));
          });
        });
      }, hardDeadlineMs);

      worker.on("message", (message: { ok: boolean; result?: AnalyzeResult; error?: string }) => {
        clearTimeout(hardTimer);
        options.signal?.removeEventListener("abort", onAbort);
        settle(() => {
          if (message.ok && message.result) resolve(message.result);
          else reject(new Error(message.error ?? "Worker analysis failed"));
        });
      });
      worker.on("error", (error) => {
        clearTimeout(hardTimer);
        options.signal?.removeEventListener("abort", onAbort);
        settle(() => reject(error));
      });
      worker.on("exit", (code) => {
        clearTimeout(hardTimer);
        options.signal?.removeEventListener("abort", onAbort);
        settle(() => {
          reject(new Error(`Analysis worker exited with code ${code} before completing`));
        });
      });
    });
  } catch (error) {
    if (spawnFailed || isSpawnFailure(error)) {
      return analyzeRepository(input, options);
    }
    throw error;
  }
}
