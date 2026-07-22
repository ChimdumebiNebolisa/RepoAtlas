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
  try {
    const { analyzeRepository } = jiti(
      path.join(process.cwd(), "src/analyzer/index.ts")
    );
    const { input, options } = workerData;
    const result = await analyzeRepository(input, {
      ...options,
      // AbortSignal cannot be cloned into workerData.
      signal: undefined,
    });
    parentPort.postMessage({ ok: true, result });
  } catch (error) {
    parentPort.postMessage({
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

main();
