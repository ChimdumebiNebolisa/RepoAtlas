/**
 * TS/JS language pack: import extraction, entrypoints, test proximity, complexity proxy.
 */

import fs from "fs";
import path from "path";
import type { Architecture } from "@/types/report";
import type { IndexingPipelineResult } from "../pipeline";

const STATIC_IMPORT_RE =
  /\bimport\s+(?:[\s\S]*?\s+from\s+)?["']([^"']+)["']/g;
const DYNAMIC_IMPORT_RE = /\bimport\s*\(\s*["']([^"']+)["']\s*\)/g;
const REQUIRE_RE = /\brequire\s*\(\s*["']([^"']+)["']\s*\)/g;

const TEST_PATTERNS = [
  /\.(test|spec)\.(ts|tsx|js|jsx|mjs|cjs)$/i,
  /__tests__\//,
];

const COMPLEXITY_RE =
  /\b(if|else|for|while|switch|catch|\?\s*:|\|\||&&)\b/g;
const SCRIPT_PATH_RE =
  /(?:^|\s|["'])(\.{0,2}\/?[\w./-]+\.(?:ts|tsx|js|jsx|mjs|cjs))(?=\s|["']|$)/g;
const CODE_EXTENSIONS = [".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"];
const RESOLUTION_EXTENSIONS = [".ts", ".tsx", ".js", ".jsx"];
const INDEX_CANDIDATES = ["/index.ts", "/index.tsx", "/index.js", "/index.jsx"];
const IGNORED_DIRS = new Set(["node_modules", ".next", "dist", "build", "coverage"]);
const ENTRY_SCRIPT_NAMES = new Set(["dev", "start", "build"]);
const ARCH_NODE_CAP = 50;
const ARCH_EDGE_CAP = 200;

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
}

function resolveImport(
  fromFile: string,
  importPath: string,
  workspacePath: string
): string | null {
  if (!importPath.startsWith("./") && !importPath.startsWith("../")) return null;

  const fromDir = path.dirname(fromFile);
  const baseResolved = path.normalize(path.join(fromDir, importPath));
  const ext = path.extname(baseResolved);

  if (ext) {
    const candidate = path.join(workspacePath, baseResolved);
    if (fs.existsSync(candidate)) return baseResolved;
    return null;
  }

  for (const extension of RESOLUTION_EXTENSIONS) {
    const resolvedPath = baseResolved + extension;
    const candidate = path.join(workspacePath, resolvedPath);
    if (fs.existsSync(candidate)) return path.normalize(resolvedPath);
  }

  for (const indexPath of INDEX_CANDIDATES) {
    const resolvedPath = baseResolved + indexPath;
    const candidate = path.join(workspacePath, resolvedPath);
    if (fs.existsSync(candidate)) return path.normalize(resolvedPath);
  }

  return null;
}

function isIgnoredPath(relPath: string): boolean {
  const normalized = normalizeRelPath(relPath);
  const segments = normalized.split("/");
  return segments.some((segment) => IGNORED_DIRS.has(segment));
}

function normalizeRelPath(relPath: string): string {
  return relPath.replace(/\\/g, "/");
}

function stripExtension(relPath: string): string {
  return relPath.replace(/\.(ts|tsx|js|jsx|mjs|cjs)$/i, "");
}

function stripTestSuffix(relPath: string): string {
  return relPath.replace(/\.(test|spec)\.(ts|tsx|js|jsx|mjs|cjs)$/i, "");
}

function extractImportSpecifiers(content: string): string[] {
  const specs: string[] = [];
  let match: RegExpExecArray | null;

  STATIC_IMPORT_RE.lastIndex = 0;
  while ((match = STATIC_IMPORT_RE.exec(content))) {
    specs.push(match[1]);
  }

  DYNAMIC_IMPORT_RE.lastIndex = 0;
  while ((match = DYNAMIC_IMPORT_RE.exec(content))) {
    specs.push(match[1]);
  }

  REQUIRE_RE.lastIndex = 0;
  while ((match = REQUIRE_RE.exec(content))) {
    specs.push(match[1]);
  }

  return specs;
}

function computeComplexitySignals(content: string): {
  loc: number;
  branchCount: number;
  maxNesting: number;
  score: number;
} {
  const loc = content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(
      (line) =>
        line.length > 0 &&
        !line.startsWith("//") &&
        !line.startsWith("/*") &&
        !line.startsWith("*") &&
        !line.startsWith("*/")
    ).length;

  const branchMatches = content.match(COMPLEXITY_RE);
  const branchCount = branchMatches ? branchMatches.length : 0;

  let currentDepth = 0;
  let maxNesting = 0;
  for (const ch of content) {
    if (ch === "{") {
      currentDepth += 1;
      if (currentDepth > maxNesting) {
        maxNesting = currentDepth;
      }
    } else if (ch === "}") {
      currentDepth = Math.max(0, currentDepth - 1);
    }
  }

  const score = branchCount * 3 + maxNesting * 2 + Math.round(loc / 40);
  return { loc, branchCount, maxNesting, score };
}

function parseEntrypointsFromScripts(
  workspacePath: string,
  fileByNormalized: Map<string, string>
): { entrypoints: Set<string>; warning?: string } {
  const entrypoints = new Set<string>();
  const pkgPath = path.join(workspacePath, "package.json");
  if (!fs.existsSync(pkgPath)) return { entrypoints };

  try {
    const pkgRaw = fs.readFileSync(pkgPath, "utf-8");
    const pkg = JSON.parse(pkgRaw) as { scripts?: Record<string, unknown> };
    const scripts = pkg.scripts ?? {};

    for (const [name, cmdValue] of Object.entries(scripts)) {
      if (!ENTRY_SCRIPT_NAMES.has(name)) continue;
      if (typeof cmdValue !== "string") continue;

      const cmd = cmdValue.trim();
      let match: RegExpExecArray | null;
      SCRIPT_PATH_RE.lastIndex = 0;
      while ((match = SCRIPT_PATH_RE.exec(cmd))) {
        const candidate = normalizeRelPath(match[1].replace(/^\.\//, ""));
        const resolved = fileByNormalized.get(candidate);
        if (resolved) {
          entrypoints.add(resolved);
        }
      }
    }
  } catch {
    return { entrypoints, warning: "Could not parse package.json for entrypoints" };
  }

  return { entrypoints };
}

function detectEntrypoints(
  files: string[],
  workspacePath: string
): { entrypoints: Set<string>; warnings: string[] } {
  const entrypoints = new Set<string>();
  const warnings: string[] = [];
  const fileByNormalized = new Map<string, string>();
  for (const file of files) {
    fileByNormalized.set(normalizeRelPath(file), file);
  }

  for (const file of files) {
    const n = normalizeRelPath(file);
    if (
      /^src\/app\/page\.(ts|tsx|js|jsx|mjs|cjs)$/i.test(n) ||
      /^app\/page\.(ts|tsx|js|jsx|mjs|cjs)$/i.test(n) ||
      /^src\/app\/layout\.(ts|tsx|js|jsx|mjs|cjs)$/i.test(n) ||
      /^app\/layout\.(ts|tsx|js|jsx|mjs|cjs)$/i.test(n) ||
      /^src\/app\/api\/.+\/route\.(ts|tsx|js|jsx|mjs|cjs)$/i.test(n) ||
      /^app\/api\/.+\/route\.(ts|tsx|js|jsx|mjs|cjs)$/i.test(n)
    ) {
      entrypoints.add(file);
    }
  }

  for (const ext of CODE_EXTENSIONS) {
    const common = [
      `src/index${ext}`,
      `src/main${ext}`,
      `src/server${ext}`,
      `src/app${ext}`,
    ];
    for (const candidate of common) {
      const resolved = fileByNormalized.get(candidate);
      if (resolved) {
        entrypoints.add(resolved);
      }
    }
  }

  const { entrypoints: fromScripts, warning: scriptWarning } =
    parseEntrypointsFromScripts(workspacePath, fileByNormalized);
  for (const ep of fromScripts) {
    entrypoints.add(ep);
  }
  if (scriptWarning) warnings.push(scriptWarning);

  return { entrypoints, warnings };
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

function toFolderPath(filePath: string): string {
  const normalized = normalizeRelPath(filePath);
  const dir = path.posix.dirname(normalized);
  return dir === "." ? "." : dir;
}

function buildReducedArchitecture(
  files: string[],
  imports: Map<string, Set<string>>
): { architecture: Architecture; warnings: string[] } {
  const warnings: string[] = [];
  const folderFileCounts = new Map<string, number>();

  for (const file of files) {
    const folder = toFolderPath(file);
    folderFileCounts.set(folder, (folderFileCounts.get(folder) ?? 0) + 1);
  }

  const edgeWeights = new Map<string, number>();
  for (const [fromFile, toFiles] of imports) {
    const fromFolder = toFolderPath(fromFile);
    for (const toFile of toFiles) {
      const toFolder = toFolderPath(toFile);
      const key = `${fromFolder}=>${toFolder}`;
      edgeWeights.set(key, (edgeWeights.get(key) ?? 0) + 1);
    }
  }

  const folderDegree = new Map<string, number>();
  for (const [edgeKey, weight] of edgeWeights) {
    const [from, to] = edgeKey.split("=>");
    folderDegree.set(from, (folderDegree.get(from) ?? 0) + weight);
    folderDegree.set(to, (folderDegree.get(to) ?? 0) + weight);
  }
  for (const folder of folderFileCounts.keys()) {
    if (!folderDegree.has(folder)) {
      folderDegree.set(folder, 0);
    }
  }

  const sortedFolders = Array.from(folderFileCounts.keys()).sort((a, b) => {
    const degreeDelta = (folderDegree.get(b) ?? 0) - (folderDegree.get(a) ?? 0);
    if (degreeDelta !== 0) return degreeDelta;
    const fileCountDelta = (folderFileCounts.get(b) ?? 0) - (folderFileCounts.get(a) ?? 0);
    if (fileCountDelta !== 0) return fileCountDelta;
    return a.localeCompare(b);
  });

  const selectedFolders = sortedFolders.slice(0, ARCH_NODE_CAP);
  if (sortedFolders.length > ARCH_NODE_CAP) {
    warnings.push(
      `Architecture nodes capped at ${ARCH_NODE_CAP} folders (from ${sortedFolders.length}).`
    );
  }

  if (files.length > selectedFolders.length) {
    warnings.push(
      `Architecture reduced from file-level (${files.length} files) to folder-level (${selectedFolders.length} folders).`
    );
  }

  const selectedFolderSet = new Set(selectedFolders);
  const edges = Array.from(edgeWeights.entries())
    .map(([edgeKey, weight]) => {
      const [from, to] = edgeKey.split("=>");
      return { from, to, weight };
    })
    .filter((edge) => selectedFolderSet.has(edge.from) && selectedFolderSet.has(edge.to))
    .sort((a, b) => {
      const weightDelta = b.weight - a.weight;
      if (weightDelta !== 0) return weightDelta;
      const fromDelta = a.from.localeCompare(b.from);
      if (fromDelta !== 0) return fromDelta;
      return a.to.localeCompare(b.to);
    })
    .slice(0, ARCH_EDGE_CAP)
    .map(({ from, to }) => ({ from, to, type: "import" as const }));

  const fullEdgeCount = Array.from(edgeWeights.keys()).filter((edgeKey) => {
    const [from, to] = edgeKey.split("=>");
    return selectedFolderSet.has(from) && selectedFolderSet.has(to);
  }).length;
  if (fullEdgeCount > ARCH_EDGE_CAP) {
    warnings.push(
      `Architecture edges capped at ${ARCH_EDGE_CAP} links (from ${fullEdgeCount}).`
    );
  }

  const nodes = selectedFolders.map((folder) => ({
    id: folder,
    label: folder === "." ? "." : folder,
    type: "folder" as const,
  }));

  return { architecture: { nodes, edges }, warnings };
}

export function runTsJsPack(
  workspacePath: string,
  pipeline: IndexingPipelineResult
): TsJsPackResult {
  const imports = new Map<string, Set<string>>();
  const fanIn = new Map<string, number>();
  const fanOut = new Map<string, number>();
  const entrypoints = new Set<string>();
  const testFiles = new Set<string>();
  const complexity = new Map<string, number>();
  const loc = new Map<string, number>();
  const maxNesting = new Map<string, number>();
  const testProximity = new Map<string, number>();

  const files = Array.from(pipeline.file_metadata.keys()).filter((f) =>
    CODE_EXTENSIONS.includes(path.extname(f)) && !isIgnoredPath(f)
  );

  for (const f of files) {
    const normalized = normalizeRelPath(f);
    if (TEST_PATTERNS.some((p) => p.test(normalized))) testFiles.add(f);
  }

  const { entrypoints: detectedEntrypoints, warnings: entrypointWarnings } =
    detectEntrypoints(files, workspacePath);
  for (const ep of detectedEntrypoints) {
    entrypoints.add(ep);
  }

  for (const f of files) {
    const fullPath = path.join(workspacePath, f);
    let content: string;
    try {
      content = fs.readFileSync(fullPath, "utf-8");
    } catch {
      continue;
    }

    const complexitySignals = computeComplexitySignals(content);
    complexity.set(f, complexitySignals.score);
    loc.set(f, complexitySignals.loc);
    maxNesting.set(f, complexitySignals.maxNesting);
    testProximity.set(f, computeTestProximityScore(f, testFiles));

    const targets = new Set<string>();
    for (const imp of extractImportSpecifiers(content)) {
      const resolved = resolveImport(f, imp, workspacePath);
      if (
        resolved &&
        pipeline.file_metadata.has(resolved) &&
        !isIgnoredPath(resolved)
      ) {
        targets.add(resolved);
      }
    }
    imports.set(f, targets);
    fanOut.set(f, targets.size);
    for (const t of targets) {
      fanIn.set(t, (fanIn.get(t) ?? 0) + 1);
    }
  }

  const { architecture, warnings: archWarnings } = buildReducedArchitecture(
    files,
    imports
  );
  const warnings = [...entrypointWarnings, ...archWarnings];

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
