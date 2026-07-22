/**
 * Isolated analysis worker host.
 * Spawns a worker thread for analyzeRepository; falls back in-process when
 * workers are unavailable (tests, restricted sandboxes).
 */

import { Worker } from "node:worker_threads";
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

export async function runIsolatedAnalysis(
  input: AnalyzeInput,
  options: IsolatedAnalyzeOptions = {}
): Promise<AnalyzeResult> {
  if (shouldRunInline(options)) {
    return analyzeRepository(input, options);
  }

  try {
    return await new Promise<AnalyzeResult>((resolve, reject) => {
      const worker = new Worker(workerScriptPath(), {
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
      let settled = false;
      worker.on("message", (message: { ok: boolean; result?: AnalyzeResult; error?: string }) => {
        if (settled) return;
        settled = true;
        if (message.ok && message.result) resolve(message.result);
        else reject(new Error(message.error ?? "Worker analysis failed"));
      });
      worker.on("error", (error) => {
        if (settled) return;
        settled = true;
        reject(error);
      });
      worker.on("exit", (code) => {
        if (settled) return;
        if (code !== 0) {
          settled = true;
          reject(new Error(`Analysis worker exited with code ${code}`));
        }
      });
    });
  } catch {
    return analyzeRepository(input, options);
  }
}
