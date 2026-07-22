/** Python language pack coordinator. */

import fs from "fs";
import path from "path";
import type { IndexingPipelineResult } from "../pipeline";
import { buildReducedArchitecture } from "./python/architecture";
import { detectEntrypoints } from "./python/entrypoints";
import {
  detectPackageRoots,
  extractImportSpecifiers,
  resolveImport,
} from "./python/imports";
import { isIgnoredPath, PY_EXTENSION } from "./python/shared";
import {
  computeComplexitySignals,
  computeTestProximityScore,
  detectTestFiles,
} from "./python/signals";
import type { PythonPackResult } from "./python/types";

export type { PythonPackResult } from "./python/types";
export { detectPackageRoots, extractImportSpecifiers, resolveImport } from "./python/imports";
export { computeComplexitySignals, computeTestProximityScore } from "./python/signals";

export function runPythonPack(
  workspacePath: string,
  pipeline: IndexingPipelineResult
): PythonPackResult {
  const imports = new Map<string, Set<string>>();
  const fanIn = new Map<string, number>();
  const fanOut = new Map<string, number>();
  const complexity = new Map<string, number>();
  const loc = new Map<string, number>();
  const maxNesting = new Map<string, number>();
  const testProximity = new Map<string, number>();
  const warnings: string[] = [];
  const files = Array.from(pipeline.file_metadata.keys()).filter(
    (file) => path.extname(file) === PY_EXTENSION && !isIgnoredPath(file)
  );
  const entrypoints = files.length ? detectEntrypoints(files, workspacePath) : new Set<string>();
  const testFiles = detectTestFiles(files);

  if (!files.length) {
    return {
      architecture: { nodes: [], edges: [] },
      imports,
      fanIn,
      fanOut,
      entrypoints,
      testFiles,
      complexity,
      loc,
      maxNesting,
      testProximity,
      warnings,
    };
  }

  const fileSet = new Set(files);
  const packageRoots = detectPackageRoots(workspacePath);
  for (const file of files) {
    let content: string;
    try {
      content = fs.readFileSync(path.join(workspacePath, file), "utf-8");
    } catch {
      imports.set(file, new Set());
      fanOut.set(file, 0);
      complexity.set(file, 0);
      loc.set(file, 0);
      maxNesting.set(file, 0);
      testProximity.set(file, computeTestProximityScore(file, testFiles));
      continue;
    }

    const targets = new Set<string>();
    for (const specifier of extractImportSpecifiers(content)) {
      const resolved = resolveImport(file, specifier, workspacePath, packageRoots, fileSet);
      if (resolved && pipeline.file_metadata.has(resolved) && !isIgnoredPath(resolved)) {
        targets.add(resolved);
      }
    }
    imports.set(file, targets);
    fanOut.set(file, targets.size);
    for (const target of targets) fanIn.set(target, (fanIn.get(target) ?? 0) + 1);

    const signals = computeComplexitySignals(content);
    complexity.set(file, signals.score);
    loc.set(file, signals.loc);
    maxNesting.set(file, signals.maxNesting);
    testProximity.set(file, computeTestProximityScore(file, testFiles));
  }

  for (const file of files) {
    if (!fanIn.has(file)) fanIn.set(file, 0);
  }
  const { architecture, warnings: architectureWarnings } = buildReducedArchitecture(files, imports);
  warnings.push(...architectureWarnings);

  return {
    architecture,
    imports,
    fanIn,
    fanOut,
    entrypoints,
    testFiles,
    complexity,
    loc,
    maxNesting,
    testProximity,
    warnings,
  };
}
