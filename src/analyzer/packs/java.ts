/** Java language-pack coordinator. */

import type { Architecture } from "@/types/report";
import type { IndexingPipelineResult } from "../pipeline";
import { buildJavaArchitecture } from "./javaArchitecture";
import { computeJavaMetrics } from "./javaMetrics";
import { discoverJavaModules } from "./javaModules";
import { buildJavaSemanticGraph } from "./javaSemantic";
import {
  buildJavaSourceIndex,
  detectJavaEntrypoints,
  selectJavaSourceFiles,
} from "./javaSources";

export { computeComplexitySignals } from "./javaMetrics";
export { collectSamePackageRefs, extractImportSpecifiers } from "./javaSemantic";

export interface JavaPackResult {
  architecture: Architecture;
  imports: Map<string, Set<string>>;
  fanIn: Map<string, number>;
  fanOut: Map<string, number>;
  entrypoints: Set<string>;
  testFiles: Set<string>;
  complexity: Map<string, number>;
  loc?: Map<string, number>;
  maxNesting?: Map<string, number>;
  testProximity?: Map<string, number>;
  warnings?: string[];
}

function emptyJavaPack(): JavaPackResult {
  return {
    architecture: { nodes: [], edges: [] },
    imports: new Map(),
    fanIn: new Map(),
    fanOut: new Map(),
    entrypoints: new Set(),
    testFiles: new Set(),
    complexity: new Map(),
    loc: new Map(),
    maxNesting: new Map(),
    testProximity: new Map(),
    warnings: [],
  };
}

export function runJavaPack(
  workspacePath: string,
  pipeline: IndexingPipelineResult
): JavaPackResult {
  const files = selectJavaSourceFiles(pipeline);
  if (!files.length) return emptyJavaPack();

  // Module discovery stays isolated from source analysis. A missing or malformed
  // manifest must never prevent the source-backed Java brief from completing.
  discoverJavaModules(workspacePath);

  const sourceIndex = buildJavaSourceIndex(files, workspacePath);
  const { entrypoints, warnings: entrypointWarnings } = detectJavaEntrypoints(
    files.filter((file) => !sourceIndex.testFiles.has(file)),
    workspacePath
  );
  const semantic = buildJavaSemanticGraph(
    files,
    workspacePath,
    pipeline,
    sourceIndex
  );
  const metrics = computeJavaMetrics(files, workspacePath, sourceIndex.testFiles);
  const { architecture, warnings: architectureWarnings } = buildJavaArchitecture(
    files,
    semantic.imports
  );

  return {
    architecture,
    ...semantic,
    entrypoints,
    testFiles: sourceIndex.testFiles,
    ...metrics,
    warnings: [...entrypointWarnings, ...architectureWarnings],
  };
}
