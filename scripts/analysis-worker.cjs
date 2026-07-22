/**
 * Analysis worker thread entry (CJS + jiti for path aliases / TypeScript).
 */
const { parentPort, workerData } = require("node:worker_threads");
const path = require("node:path");
const jiti = require("jiti")(__filename, {
  alias: {
    "@": path.join(process.cwd(), "src"),
  },
  interopDefault: true,
});

async function main() {
  if (!parentPort) throw new Error("analysis-worker must run as a worker thread");
  const deadlineMs =
    typeof workerData?.options?.deadlineMs === "number" && workerData.options.deadlineMs > 0
      ? workerData.options.deadlineMs
      : undefined;
  const controller = new AbortController();
  let timer = null;
  if (deadlineMs) {
    timer = setTimeout(() => controller.abort(), deadlineMs);
  }
  try {
    const { analyzeRepository } = jiti(
      path.join(process.cwd(), "src/analyzer/index.ts")
    );
    const { input, options } = workerData;
    const result = await analyzeRepository(input, {
      ...options,
      signal: controller.signal,
    });
    parentPort.postMessage({ ok: true, result });
  } catch (error) {
    parentPort.postMessage({
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    });
  } finally {
    if (timer) clearTimeout(timer);
  }
}

main();
