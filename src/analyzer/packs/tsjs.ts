/**
 * TS/JS language pack: parser-backed semantic graph, coupling, complexity, entrypoints.
 */

import fs from "fs";
import path from "path";
import type { Architecture } from "@/types/report";
import type { SemanticEdge, SemanticGraph, SemanticNode } from "@/types/semanticGraph";
import type { IndexingPipelineResult } from "../pipeline";
import { shouldSkipPath } from "../ignoreRules";
import {
  deriveArchitectureFromSemantic,
  edgeId,
  fanMapsFromImports,
  fileNodeId,
  finalizeSemanticGraph,
  importsFromSemanticGraph,
  normalizeRelPath,
  packageNodeId,
} from "../semanticGraph";
import {
  computeAstComplexity,
  extractModuleRefsFromSource,
  scriptKindForPath,
} from "./tsjsExtract";
import { createTsJsResolver } from "./tsjsResolve";
import { detectTsJsEntrypoints } from "./tsjsEntrypoints";

const TEST_PATTERNS = [
  /\.(test|spec)\.(ts|tsx|js|jsx|mjs|cjs)$/i,
  /__tests__\//,
];

const CODE_EXTENSIONS = [".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"];

export interface TsJsPackResult {
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
  semanticGraph?: SemanticGraph;
  /** Evidence map: path -> entrypoint reason */
  entrypointReasons?: Map<string, string>;
}

function isIgnoredPath(relPath: string): boolean {
  return shouldSkipPath(relPath);
}

function stripExtension(relPath: string): string {
  return relPath.replace(/\.(ts|tsx|js|jsx|mjs|cjs)$/i, "");
}

function stripTestSuffix(relPath: string): string {
  return relPath.replace(/\.(test|spec)\.(ts|tsx|js|jsx|mjs|cjs)$/i, "");
}

function computeTestProximityScore(
  filePath: string,
  testFiles: Set<string>
): number {
  const normFile = normalizeRelPath(filePath);
  if (testFiles.has(filePath)) return 100;

  const fileDir = path.posix.dirname(normFile);
  const strippedFile = stripExtension(normFile);
  const strippedFileSansSrc = stripExtension(normFile.replace(/^src\//, ""));

  let best = 0;
  for (const testFile of testFiles) {
    const normTest = normalizeRelPath(testFile);
    const testDir = path.posix.dirname(normTest);

    if (testDir === fileDir) {
      best = Math.max(best, 100);
      continue;
    }

    if (
      testDir === `${fileDir}/__tests__` ||
      normTest.startsWith(`${fileDir}/__tests__/`)
    ) {
      best = Math.max(best, 90);
      continue;
    }

    if (normTest.startsWith("tests/")) {
      const mirrored = stripTestSuffix(normTest.slice("tests/".length));
      if (
        mirrored === strippedFile ||
        mirrored === strippedFileSansSrc ||
        mirrored.endsWith(`/${path.posix.basename(strippedFile)}`)
      ) {
        best = Math.max(best, 80);
      }
    }
  }

  return best;
}

function languageFor(relPath: string): string {
  const ext = path.extname(relPath).toLowerCase();
  if (ext === ".ts" || ext === ".tsx") return "typescript";
  return "javascript";
}

export function runTsJsPack(
  workspacePath: string,
  pipeline: IndexingPipelineResult
): TsJsPackResult {
  const testFiles = new Set<string>();
  const complexity = new Map<string, number>();
  const loc = new Map<string, number>();
  const maxNesting = new Map<string, number>();
  const testProximity = new Map<string, number>();
  const warnings: string[] = [];

  const files = Array.from(pipeline.file_metadata.keys()).filter(
    (f) => CODE_EXTENSIONS.includes(path.extname(f)) && !isIgnoredPath(f)
  );
  const fileIndex = new Set(files.map((f) => normalizeRelPath(f)));
  const fileByNormalized = new Map(
    files.map((file) => [normalizeRelPath(file), file])
  );

  for (const f of files) {
    const normalized = normalizeRelPath(f);
    if (TEST_PATTERNS.some((p) => p.test(normalized))) testFiles.add(f);
  }

  const resolver = createTsJsResolver(workspacePath, fileIndex, isIgnoredPath);
  warnings.push(...resolver.warnings);

  const packageJsonRels = [
    ...new Set([
      "package.json",
      ...resolver.workspacePackages.map((p) => p.packageJsonRel),
    ]),
  ].filter((rel) => fs.existsSync(path.join(workspacePath, rel)));

  const { entrypoints: entrypointMap, warnings: entrypointWarnings } =
    detectTsJsEntrypoints(files, workspacePath, packageJsonRels);
  warnings.push(...entrypointWarnings);

  const nodesById = new Map<string, SemanticNode>();
  const edges: SemanticEdge[] = [];

  const ensureFileNode = (relPath: string, kind: SemanticNode["kind"] = "file") => {
    const id = fileNodeId(relPath);
    const existing = nodesById.get(id);
    if (existing) {
      if (kind === "entrypoint" && existing.kind !== "entrypoint") {
        existing.kind = "entrypoint";
        existing.entrypoint_reason = entrypointMap.get(relPath);
      }
      return existing;
    }
    const node: SemanticNode = {
      id,
      kind,
      label: normalizeRelPath(relPath),
      language: languageFor(relPath),
      entrypoint_reason:
        kind === "entrypoint" ? entrypointMap.get(relPath) : undefined,
    };
    nodesById.set(id, node);
    return node;
  };

  const ensurePackageNode = (name: string) => {
    const id = packageNodeId(name);
    if (!nodesById.has(id)) {
      nodesById.set(id, {
        id,
        kind: "package",
        label: name,
        language: "typescript",
      });
    }
    return id;
  };

  for (const [epPath, reason] of entrypointMap) {
    const node = ensureFileNode(epPath, "entrypoint");
    node.entrypoint_reason = reason;
  }

  for (const pkg of resolver.workspacePackages) {
    ensurePackageNode(pkg.name);
  }

  for (const f of files) {
    ensureFileNode(f, entrypointMap.has(f) ? "entrypoint" : "file");

    const fullPath = path.join(workspacePath, f);
    let content: string;
    try {
      content = fs.readFileSync(fullPath, "utf-8");
    } catch {
      warnings.push(`Could not read ${normalizeRelPath(f)} for semantic analysis.`);
      continue;
    }

    const scriptKind = scriptKindForPath(f);
    const complexitySignals = computeAstComplexity(content, f, scriptKind);
    complexity.set(f, complexitySignals.score);
    loc.set(f, complexitySignals.loc);
    maxNesting.set(f, complexitySignals.maxNesting);
    testProximity.set(f, computeTestProximityScore(f, testFiles));

    const { refs } = extractModuleRefsFromSource(f, content, scriptKind);
    const fromId = fileNodeId(f);

    for (const ref of refs) {
      if (ref.specifier == null) {
        edges.push({
          id: edgeId({
            from: fromId,
            kind: ref.kind,
            specifier: "<non_literal>",
            line: ref.lineStart,
          }),
          from: fromId,
          specifier: "<non_literal>",
          kind: ref.kind,
          resolution: "unresolved",
          reason: ref.reason ?? "non_literal_specifier",
          type_only: ref.typeOnly || undefined,
          evidence: {
            path: normalizeRelPath(f),
            line_start: ref.lineStart,
            line_end: ref.lineEnd,
            snippet: ref.snippet,
          },
        });
        continue;
      }

      const outcome = resolver.resolve(f, ref.specifier);
      let to: string | undefined;
      let resolution = outcome.status;
      let reason: string | undefined;

      if (outcome.status === "resolved_internal") {
        const resolved =
          fileByNormalized.get(normalizeRelPath(outcome.relPath)) ??
          outcome.relPath;
        ensureFileNode(resolved);
        to = fileNodeId(resolved);
      } else if (outcome.status === "resolved_external") {
        to = ensurePackageNode(outcome.packageName);
      } else if (outcome.status === "ignored") {
        reason = outcome.reason;
      } else {
        reason = outcome.reason;
      }

      edges.push({
        id: edgeId({
          from: fromId,
          kind: ref.kind,
          specifier: ref.specifier,
          line: ref.lineStart,
          to,
        }),
        from: fromId,
        to,
        specifier: ref.specifier,
        kind: ref.kind,
        resolution,
        reason,
        type_only: ref.typeOnly || undefined,
        evidence: {
          path: normalizeRelPath(f),
          line_start: ref.lineStart,
          line_end: ref.lineEnd,
          snippet: ref.snippet,
        },
      });
    }
  }

  // Deduplicate edges that share the same id (e.g. identical dual visits).
  const edgeById = new Map<string, SemanticEdge>();
  for (const edge of edges) {
    if (!edgeById.has(edge.id)) edgeById.set(edge.id, edge);
  }

  const semanticGraph = finalizeSemanticGraph({
    language: "typescript",
    adapter: "tsjs-typescript-compiler-api",
    nodes: Array.from(nodesById.values()),
    edges: Array.from(edgeById.values()),
    warnings: [],
  });

  const imports = importsFromSemanticGraph(semanticGraph);
  // Ensure every analyzed file has an imports entry for Start Here BFS.
  for (const f of files) {
    if (!imports.has(f)) imports.set(f, new Set());
  }
  const { fanIn, fanOut } = fanMapsFromImports(files, imports);

  const { architecture, warnings: archWarnings } = deriveArchitectureFromSemantic(
    files,
    semanticGraph
  );
  warnings.push(...archWarnings);

  if (semanticGraph.stats.unresolved > 0) {
    warnings.push(
      `TS/JS semantic graph recorded ${semanticGraph.stats.unresolved} unresolved import edge(s).`
    );
  }

  return {
    architecture,
    imports,
    fanIn,
    fanOut,
    entrypoints: new Set(entrypointMap.keys()),
    entrypointReasons: entrypointMap,
    testFiles,
    complexity,
    loc,
    maxNesting,
    testProximity,
    warnings,
    semanticGraph,
  };
}
