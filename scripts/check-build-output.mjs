import { spawn } from "node:child_process";

const nextBin = process.platform === "win32" ? "next.cmd" : "next";
const broadTraceMarkers = [
  "Encountered unexpected file in NFT list",
  "whole project was traced unintentionally",
];
let buildOutput = "";

const child = spawn(nextBin, ["build"], {
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

child.on("close", (code, signal) => {
  if (broadTraceMarkers.some((marker) => buildOutput.includes(marker))) {
    console.error(
      "Build failed because broad server-file tracing returned. Scope filesystem access or mark the intentional runtime path with turbopackIgnore."
    );
    process.exitCode = 1;
    return;
  }

  if (signal) {
    console.error(`Next.js build terminated by signal ${signal}.`);
    process.exitCode = 1;
    return;
  }

  process.exitCode = code ?? 1;
});
