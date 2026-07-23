/**
 * Analysis worker thread entry (CJS + jiti for path aliases / TypeScript).
 * Serializes AppError fields so the host can preserve HTTP status codes.
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
    parentPort.postMessage({ ready: true });
    const { input, options } = workerData;
    const result = await analyzeRepository(input, {
      ...options,
      signal: controller.signal,
    });
    parentPort.postMessage({ ok: true, result });
  } catch (error) {
    const payload = {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
    // Duck-type AppError: jiti can break `instanceof` across realms.
    if (
      error &&
      typeof error === "object" &&
      typeof error.code === "string" &&
      typeof error.status === "number" &&
      typeof error.message === "string"
    ) {
      payload.appError = {
        code: error.code,
        status: error.status,
        message: error.message,
        expose: error.expose !== false,
      };
    }
    parentPort.postMessage(payload);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

main();
