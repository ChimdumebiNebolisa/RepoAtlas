import path from "path";
import type { StartHereItem } from "@/types/report";
import type { IndexingPipelineResult } from "../pipeline";
import type { TsJsPackResult } from "../packs/tsjs";
import type { PythonPackResult } from "../packs/python";
import type { JavaPackResult } from "../packs/java";
import { rankStartHere } from "./ranking";
import {
  addReason,
  CODE_EXTENSIONS,
  computeEntrypointDistance,
  JAVA_EXTENSION,
  normalizePath,
  PYTHON_EXTENSION,
  type StartHereCandidate,
} from "./shared";

function addDistanceSignal(
  candidate: StartHereCandidate,
  distance: number | undefined
): void {
  if (distance === 0) {
    candidate.rawScore += 90;
    addReason(candidate, "detected entrypoint");
  } else if (distance === 1) {
    candidate.rawScore += 35;
    addReason(candidate, "directly imported by an entrypoint");
  } else if (distance !== undefined && distance <= 3) {
    candidate.rawScore += 18 - distance * 4;
    addReason(candidate, `within ${distance} import hops of an entrypoint`);
  }
}

export function computeStartHere(
  pipeline: IndexingPipelineResult,
  tsjs?: TsJsPackResult | null,
  python?: PythonPackResult | null,
  java?: JavaPackResult | null
): StartHereItem[] {
  const candidates = new Map<string, StartHereCandidate>();
  const getCandidate = (filePath: string): StartHereCandidate => {
    const existing = candidates.get(filePath);
    if (existing) return existing;
    const created: StartHereCandidate = { path: filePath, rawScore: 0, reasons: [] };
    candidates.set(filePath, created);
    return created;
  };

  for (const doc of pipeline.key_docs) {
    const candidate = getCandidate(doc);
    const baseName = path.basename(doc).toLowerCase();
    const normalizedDoc = normalizePath(doc).toLowerCase();
    // Nested documentation (package/example READMEs) must not outrank the
    // repository's root README. Real repositories such as Gson ship READMEs in
    // every subfolder; without a depth penalty the lexicographic tie-break put
    // "examples/…" ahead of the root README.
    const nestedPenalty = Math.min(40, (normalizedDoc.split("/").length - 1) * 20);
    let baseScore: number;
    if (baseName === "readme.md" || baseName === "readme") {
      baseScore = 95;
      addReason(candidate, "root README documentation");
    } else if (baseName.startsWith("readme")) {
      baseScore = 80;
      addReason(candidate, "README documentation");
    } else if (baseName.startsWith("contributing")) {
      baseScore = 75;
      addReason(candidate, "contribution guide");
    } else {
      baseScore = 45;
      addReason(candidate, "key project documentation");
    }
    candidate.rawScore += Math.max(10, baseScore - nestedPenalty);
    if (normalizedDoc.includes("/docs/")) {
      candidate.rawScore += 5;
      addReason(candidate, "project docs reference");
    }
  }

  if (tsjs) {
    const codeFiles = Array.from(pipeline.file_metadata.keys()).filter((filePath) =>
      CODE_EXTENSIONS.has(path.extname(filePath))
    );
    const entrypointDistance = computeEntrypointDistance(tsjs.entrypoints, tsjs.imports);

    for (const filePath of codeFiles) {
      const normalized = normalizePath(filePath);
      const candidate = getCandidate(filePath);

      if (/(?:^|\/)app\/api\/.+\/route\.(ts|tsx|js|jsx|mjs|cjs)$/i.test(normalized)) {
        candidate.rawScore += 85;
        addReason(candidate, "Next.js route handler");
      } else if (/(?:^|\/)app\/page\.(ts|tsx|js|jsx|mjs|cjs)$/i.test(normalized)) {
        candidate.rawScore += 80;
        addReason(candidate, "Next.js page entry");
      } else if (/(?:^|\/)app\/layout\.(ts|tsx|js|jsx|mjs|cjs)$/i.test(normalized)) {
        candidate.rawScore += 75;
        addReason(candidate, "Next.js layout entry");
      } else if (/(?:^|\/)(router|routes)\.(ts|tsx|js|jsx|mjs|cjs)$/i.test(normalized)) {
        candidate.rawScore += 65;
        addReason(candidate, "router module");
      }

      const fanIn = tsjs.fanIn.get(filePath) ?? 0;
      if (fanIn > 0) {
        candidate.rawScore += Math.min(35, fanIn * 3);
        addReason(candidate, `imported by ${fanIn} files`);
      }

      addDistanceSignal(candidate, entrypointDistance.get(filePath));

      if (
        /\.(test|spec)\.(ts|tsx|js|jsx|mjs|cjs)$/i.test(normalized) ||
        /\/__tests__\//i.test(normalized)
      ) {
        candidate.rawScore -= 40;
      }
    }
  }

  if (python) {
    const codeFiles = Array.from(pipeline.file_metadata.keys()).filter(
      (filePath) => path.extname(filePath) === PYTHON_EXTENSION
    );
    const entrypointDistance = computeEntrypointDistance(python.entrypoints, python.imports);

    for (const filePath of codeFiles) {
      const normalized = normalizePath(filePath);
      const candidate = getCandidate(filePath);
      const baseName = path.basename(normalized).toLowerCase();

      if (/__main__\.py$/i.test(normalized)) {
        candidate.rawScore += 90;
        addReason(candidate, "runnable module (__main__.py)");
      } else if (/manage\.py$/i.test(normalized) && python.entrypoints.has(filePath)) {
        candidate.rawScore += 85;
        addReason(candidate, "Django management command");
      } else if (baseName === "main.py") {
        candidate.rawScore += 80;
        addReason(candidate, "common entry file");
      } else if (baseName === "app.py" || baseName === "server.py") {
        candidate.rawScore += 75;
        addReason(candidate, "application entry file");
      } else if (baseName === "cli.py") {
        candidate.rawScore += 70;
        addReason(candidate, "CLI entry file");
      } else if (/settings\.py$/i.test(normalized)) {
        candidate.rawScore += 85;
        addReason(candidate, "Django settings module");
      } else if (/urls\.py$/i.test(normalized)) {
        candidate.rawScore += 80;
        addReason(candidate, "Django routing configuration");
      }

      const fanIn = python.fanIn.get(filePath) ?? 0;
      if (fanIn > 0) {
        candidate.rawScore += Math.min(35, fanIn * 3);
        addReason(candidate, `imported by ${fanIn} modules`);
      }

      addDistanceSignal(candidate, entrypointDistance.get(filePath));

      if (
        /^test_.*\.py$/i.test(baseName) ||
        /_test\.py$/i.test(normalized) ||
        /^tests?\//i.test(normalized)
      ) {
        candidate.rawScore -= 40;
      }
    }
  }

  if (java) {
    for (const filePath of pipeline.file_metadata.keys()) {
      const normalized = normalizePath(filePath);
      const baseName = path.basename(normalized).toLowerCase();
      const isRoot = !normalized.includes("/") || normalized.split("/").length <= 1;
      if (isRoot && (baseName === "pom.xml" || baseName.startsWith("build.gradle"))) {
        const candidate = getCandidate(filePath);
        candidate.rawScore += 85;
        addReason(
          candidate,
          baseName === "pom.xml" ? "Maven build definition" : "Gradle build definition"
        );
      }
      if (isRoot && baseName.startsWith("settings.gradle")) {
        const candidate = getCandidate(filePath);
        candidate.rawScore += 70;
        addReason(candidate, "Gradle settings");
      }
    }

    const javaFiles = Array.from(pipeline.file_metadata.keys()).filter(
      (filePath) => path.extname(filePath) === JAVA_EXTENSION
    );
    const entrypointDistance = computeEntrypointDistance(java.entrypoints, java.imports);

    for (const filePath of javaFiles) {
      const normalized = normalizePath(filePath);
      const candidate = getCandidate(filePath);
      const fanIn = java.fanIn.get(filePath) ?? 0;
      if (fanIn > 0) {
        candidate.rawScore += Math.min(35, fanIn * 3);
        addReason(candidate, `imported by ${fanIn} classes`);
      }

      addDistanceSignal(candidate, entrypointDistance.get(filePath));

      if (/Test\.java$|IT\.java$|Tests\.java$|TestCase\.java$/i.test(normalized)) {
        candidate.rawScore -= 40;
      }
    }
  }

  return rankStartHere(candidates.values());
}
