import { spawn } from "node:child_process";
import { readdir, readFile, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";

const require = createRequire(import.meta.url);
const nextCli = require.resolve("next/dist/bin/next");
const broadTraceMarkers = [
  "Encountered unexpected file in NFT list",
  "whole project was traced unintentionally",
];
let buildOutput = "";

function isRuntimeReportPath(file) {
  return file.replaceAll("\\", "/").includes("/reports/");
}

async function sanitizeRuntimeDataTraces(directory) {
  let removed = 0;
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      removed += await sanitizeRuntimeDataTraces(entryPath);
      continue;
    }
    if (!entry.name.endsWith(".nft.json")) continue;

    const trace = JSON.parse(await readFile(entryPath, "utf8"));
    const files = trace.files.filter((file) => !isRuntimeReportPath(file));
    removed += trace.files.length - files.length;
    if (files.length !== trace.files.length) {
      await writeFile(entryPath, JSON.stringify({ ...trace, files }));
    }
  }
  return removed;
}

// RepoAtlas deliberately walks repository files supplied at request time. The
// current Turbopack tracer follows those dynamic paths back to the project root;
// Webpack's supported production builder keeps that runtime boundary intact.
const child = spawn(process.execPath, [nextCli, "build", "--webpack"], {
  env: process.env,
  shell: false,
  stdio: ["inherit", "pipe", "pipe"],
});

for (const stream of [child.stdout, child.stderr]) {
  stream.on("data", (chunk) => {
    const text = chunk.toString();
    buildOutput += text;
    const destination = stream === child.stdout ? process.stdout : process.stderr;
    destination.write(text);
  });
}

child.on("error", (error) => {
  console.error(`Unable to start the Next.js build: ${error.message}`);
  process.exitCode = 1;
});

child.on("close", async (code, signal) => {
  if (broadTraceMarkers.some((marker) => buildOutput.includes(marker))) {
    console.error(
      "Build failed because broad server-file tracing returned. Keep repository filesystem access outside the build-time trace."
    );
    process.exitCode = 1;
    return;
  }

  if (signal) {
    console.error(`Next.js build terminated by signal ${signal}.`);
    process.exitCode = 1;
    return;
  }

  if (code === 0) {
    const removedRuntimeFiles = await sanitizeRuntimeDataTraces(
      path.join(process.cwd(), ".next")
    );
    if (removedRuntimeFiles > 0) {
      console.log(
        `Removed ${removedRuntimeFiles} runtime report files from deployment traces.`
      );
    }
    const analyzeTracePath = path.join(
      process.cwd(),
      ".next",
      "server",
      "app",
      "api",
      "analyze",
      "route.js.nft.json"
    );
    const analyzeTrace = JSON.parse(await readFile(analyzeTracePath, "utf8"));
    const tracedFiles = analyzeTrace.files.map((file) => file.replaceAll("\\", "/"));
    if (!tracedFiles.some((file) => file.endsWith("/fixtures/repo-ts/README.md"))) {
      console.error(
        "Build failed because the deployed analysis route omitted the bundled sample README."
      );
      process.exitCode = 1;
      return;
    }
    if (tracedFiles.some(isRuntimeReportPath)) {
      console.error(
        "Build failed because runtime report data was included in the deployed analysis route."
      );
      process.exitCode = 1;
      return;
    }
  }

  process.exitCode = code ?? 1;
});
