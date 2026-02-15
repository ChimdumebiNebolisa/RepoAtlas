/**
 * Python language pack: import extraction, entrypoints, test proximity, complexity proxy.
 */

import fs from "fs";
import path from "path";
import type { Architecture } from "@/types/report";
import type { IndexingPipelineResult } from "../pipeline";

const PY_EXTENSION = ".py";
const IGNORED_DIRS = new Set([
  "venv",
  ".venv",
  "site-packages",
  "dist",
  "build",
  "__pycache__",
  ".pytest_cache",
  ".tox",
  "eggs",
  ".eggs",
]);
const ARCH_NODE_CAP = 50;
const ARCH_EDGE_CAP = 200;

const TEST_PATTERNS = [
  /^test_.*\.py$/i,
  /.*_test\.py$/i,
  /^tests?\//,
];
const COMMON_ENTRY_NAMES = ["main.py", "app.py", "cli.py", "server.py", "manage.py", "run.py"];
const PYPROJECT_SCRIPTS_RE = /\[project\.scripts\]\s*[\s\S]*?(\w+)\s*=\s*["']([^:]+):(\w+)["']/g;
const SETUP_ENTRY_RE = /['"]console_scripts['"]\s*:\s*\[[\s\S]*?['"](\w+)=([^:]+):(\w+)["']/g;

const COMPLEXITY_RE =
  /\b(if|elif|else|for|while|try|except|finally|with|and|or|match|case)\b/g;

// Python import patterns: import x, import x.y, from x import y, from . import x, from ..pkg import mod
const IMPORT_RE = /^\s*import\s+([\w.]+)(?:\s+as\s+\w+)?/gm;
const IMPORT_MULTI_RE = /^\s*import\s+([\s\S]+?)(?=\s*$|\s*#)/gm;
const FROM_IMPORT_RE = /^\s*from\s+([\w.]+)\s+import\s+/gm;
const FROM_RELATIVE_IMPORT_RE = /^\s*from\s+(\.+)([\w.]*)\s+import\s+([^#\n]+)/gm;

export interface PythonPackResult {
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

function normalizeRelPath(relPath: string): string {
  return relPath.replace(/\\/g, "/");
}

function isIgnoredPath(relPath: string): boolean {
  const normalized = normalizeRelPath(relPath);
  const segments = normalized.split("/");
  return segments.some((segment) => IGNORED_DIRS.has(segment));
}

function stripExtension(relPath: string): string {
  return relPath.replace(/\.py$/i, "");
}

function stripTestSuffix(relPath: string): string {
  return relPath.replace(/^test_/, "").replace(/_test\.py$/i, ".py");
}

/** Extract module specs from Python source (absolute and relative). */
export function extractImportSpecifiers(content: string): string[] {
  const specs: string[] = [];
  const seen = new Set<string>();

  // import x / import x as y / import x.y
  let m: RegExpExecArray | null;
  IMPORT_RE.lastIndex = 0;
  while ((m = IMPORT_RE.exec(content))) {
    const spec = m[1].trim();
    if (spec && !seen.has(spec)) {
      seen.add(spec);
      specs.push(spec);
    }
  }

  // import a, b, c (multi)
  IMPORT_MULTI_RE.lastIndex = 0;
  while ((m = IMPORT_MULTI_RE.exec(content))) {
    const rest = m[1].trim();
    if (rest.startsWith("(")) continue; // parenthesized handled below
    const parts = rest.split(",").map((p) => p.replace(/\s+as\s+\w+$/, "").trim());
    for (const part of parts) {
      const spec = part.split(/\s/)[0];
      if (spec && !seen.has(spec)) {
        seen.add(spec);
        specs.push(spec);
      }
    }
  }

  // from x import y / from x.y import z
  FROM_IMPORT_RE.lastIndex = 0;
  while ((m = FROM_IMPORT_RE.exec(content))) {
    const spec = m[1].trim();
    if (spec && !seen.has(spec)) {
      seen.add(spec);
      specs.push(spec);
    }
  }

  // from . import x / from ..pkg import mod
  FROM_RELATIVE_IMPORT_RE.lastIndex = 0;
  while ((m = FROM_RELATIVE_IMPORT_RE.exec(content))) {
    const dots = m[1];
    const pkgRest = (m[2] ?? "").trim();
    const importList = (m[3] ?? "").trim();
    const base = dots + (pkgRest ? pkgRest.replace(/^\.*/, "") : "");
    const names = importList
      .split(",")
      .map((n) => n.replace(/\s+as\s+\S+$/, "").trim().split(/\s/)[0])
      .filter((n) => n && n !== "*");
    for (const name of names) {
      const spec = base ? `${base}.${name}` : `.${name}`;
      if (!seen.has(spec)) {
        seen.add(spec);
        specs.push(spec);
      }
    }
  }

  return specs;
}

/** Detect package roots (e.g. src/ or ''). */
export function detectPackageRoots(workspacePath: string): string[] {
  const roots: string[] = [];

  // pyproject.toml: best-effort regex for package-dir or src layout
  const pyprojectPath = path.join(workspacePath, "pyproject.toml");
  if (fs.existsSync(pyprojectPath)) {
    try {
      const content = fs.readFileSync(pyprojectPath, "utf-8");
      if (/package-dir|packages\s*=\s*find_packages\s*\(\s*["']src["']\s*\)|\[tool\.setuptools\.packages\.find\]/.test(content)) {
        roots.push("src/");
      }
    } catch {
      // ignore
    }
  }

  // setup.py: package_dir={'': 'src'} or find_packages('src')
  const setupPath = path.join(workspacePath, "setup.py");
  if (fs.existsSync(setupPath)) {
    try {
      const content = fs.readFileSync(setupPath, "utf-8");
      if (/package_dir\s*=\s*\{[^}]*['"]:['"]\s*src\s*['"]\s*\}/.test(content) || /find_packages\s*\(\s*['"]src['"]\s*\)/.test(content)) {
        if (!roots.includes("src/")) roots.push("src/");
      }
    } catch {
      // ignore
    }
  }

  // Heuristic: src/ with __init__.py
  const srcPath = path.join(workspacePath, "src");
  if (fs.existsSync(srcPath) && fs.statSync(srcPath).isDirectory()) {
    const hasInit = (dir: string): boolean => {
      try {
        const entries = fs.readdirSync(dir);
        if (entries.includes("__init__.py")) return true;
        return entries.some((e) => {
          const full = path.join(dir, e);
          return fs.statSync(full).isDirectory() && hasInit(full);
        });
      } catch {
        return false;
      }
    };
    if (hasInit(srcPath) && !roots.includes("src/")) roots.push("src/");
  }

  roots.push("");
  return roots;
}

/** Resolve module path to file path under a base dir. */
function resolveModulePath(
  baseDir: string,
  modulePath: string,
  workspacePath: string
): string | null {
  if (!modulePath) return null;
  const normalized = normalizeRelPath(baseDir);
  const parts = modulePath.split(".");
  const relPath = parts.join("/");

  const asFile = path.join(workspacePath, normalized, relPath + ".py");
  if (fs.existsSync(asFile)) {
    const rel = path.relative(workspacePath, asFile);
    return normalizeRelPath(rel);
  }

  const asPkg = path.join(workspacePath, normalized, relPath, "__init__.py");
  if (fs.existsSync(asPkg)) {
    const rel = path.relative(workspacePath, asPkg);
    return normalizeRelPath(rel);
  }

  return null;
}

/** Resolve import spec to repo-relative file path, or null if third-party/unresolved. */
export function resolveImport(
  fromFile: string,
  importPath: string,
  workspacePath: string,
  packageRoots: string[],
  fileSet: Set<string>
): string | null {
  const fromDir = path.dirname(normalizeRelPath(fromFile));

  if (importPath.startsWith(".")) {
    const dotCount = (importPath.match(/^\.+/)?.[0]?.length ?? 0);
    const rest = importPath.slice(dotCount).replace(/^\.+/, "");
    const up = dotCount === 1 ? fromDir : path.join(fromDir, ...Array(dotCount - 1).fill(".."));
    const baseDir = path.normalize(up).replace(/\\/g, "/");
    const resolved = resolveModulePath(baseDir, rest || "", workspacePath);
    if (resolved && fileSet.has(resolved)) return resolved;
    if (resolved) return resolved;
    if (!rest) {
      const initPath = path.join(up, "__init__.py");
      const normalized = path.normalize(initPath).replace(/\\/g, "/");
      if (fileSet.has(normalized)) return normalized;
    }
    return null;
  }

  for (const root of packageRoots) {
    const baseDir = root === "" ? "." : root.replace(/\/$/, "");
    const resolved = resolveModulePath(baseDir, importPath, workspacePath);
    if (resolved && fileSet.has(resolved)) return resolved;
  }

  return null;
}

function parseEntrypointsFromPyproject(
  workspacePath: string,
  fileByNormalized: Map<string, string>
): Set<string> {
  const entrypoints = new Set<string>();
  const p = path.join(workspacePath, "pyproject.toml");
  if (!fs.existsSync(p)) return entrypoints;
  try {
    const content = fs.readFileSync(p, "utf-8");
    let m: RegExpExecArray | null;
    PYPROJECT_SCRIPTS_RE.lastIndex = 0;
    while ((m = PYPROJECT_SCRIPTS_RE.exec(content))) {
      const modulePath = (m[2] ?? "").replace(/\./g, "/") + ".py";
      const candidate = modulePath;
      const resolved = fileByNormalized.get(candidate) ?? fileByNormalized.get("src/" + candidate);
      if (resolved) entrypoints.add(resolved);
    }
  } catch {
    // ignore
  }
  return entrypoints;
}

function parseEntrypointsFromSetup(
  workspacePath: string,
  fileByNormalized: Map<string, string>
): Set<string> {
  const entrypoints = new Set<string>();
  const p = path.join(workspacePath, "setup.py");
  if (!fs.existsSync(p)) return entrypoints;
  try {
    const content = fs.readFileSync(p, "utf-8");
    let m: RegExpExecArray | null;
    SETUP_ENTRY_RE.lastIndex = 0;
    while ((m = SETUP_ENTRY_RE.exec(content))) {
      const modulePath = (m[2] ?? "").replace(/\./g, "/") + ".py";
      const resolved = fileByNormalized.get(modulePath) ?? fileByNormalized.get("src/" + modulePath);
      if (resolved) entrypoints.add(resolved);
    }
  } catch {
    // ignore
  }
  return entrypoints;
}

function detectEntrypoints(
  files: string[],
  workspacePath: string
): Set<string> {
  const entrypoints = new Set<string>();
  const fileByNormalized = new Map<string, string>();
  for (const file of files) {
    fileByNormalized.set(normalizeRelPath(file), file);
  }

  for (const file of files) {
    const n = normalizeRelPath(file);
    if (/__main__\.py$/i.test(n)) {
      entrypoints.add(file);
    }
    const base = path.posix.basename(n);
    if (COMMON_ENTRY_NAMES.some((name) => base.toLowerCase() === name.toLowerCase())) {
      entrypoints.add(file);
    }
  }

  for (const ep of parseEntrypointsFromPyproject(workspacePath, fileByNormalized)) {
    entrypoints.add(ep);
  }
  for (const ep of parseEntrypointsFromSetup(workspacePath, fileByNormalized)) {
    entrypoints.add(ep);
  }

  return entrypoints;
}

export function computeTestProximityScore(filePath: string, testFiles: Set<string>): number {
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

    if (normTest.startsWith("tests/") || normTest.startsWith("test/")) {
      const after = normTest.startsWith("tests/") ? normTest.slice(6) : normTest.slice(5);
      const mirrored = stripTestSuffix(after);
      const mirroredStripped = stripExtension(mirrored);
      if (
        mirroredStripped === strippedFile ||
        mirroredStripped === strippedFileSansSrc ||
        mirroredStripped.endsWith("/" + path.posix.basename(strippedFile))
      ) {
        best = Math.max(best, 80);
      }
    }
  }

  return best;
}

export function computeComplexitySignals(content: string): {
  loc: number;
  branchCount: number;
  maxNesting: number;
  score: number;
} {
  const lines = content.split(/\r?\n/);
  const loc = lines
    .map((line) => line.trim())
    .filter(
      (line) =>
        line.length > 0 &&
        !line.startsWith("#") &&
        !line.startsWith('"""') &&
        !line.startsWith("'''")
    ).length;

  const branchMatches = content.match(COMPLEXITY_RE);
  const branchCount = branchMatches ? branchMatches.length : 0;

  let maxNesting = 0;
  for (const line of lines) {
    if (line.trim().length === 0) continue;
    const leadingSpaces = line.match(/^(\s*)/)?.[1].length ?? 0;
    const indentLevel = Math.floor(leadingSpaces / 4);
    maxNesting = Math.max(maxNesting, indentLevel);
  }

  const score = branchCount * 3 + maxNesting * 2 + Math.round(loc / 40);
  return { loc, branchCount, maxNesting, score };
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
    label: folder === "." ? "." : path.posix.basename(folder),
    type: "folder" as const,
  }));

  return { architecture: { nodes, edges }, warnings };
}

export function runPythonPack(
  workspacePath: string,
  pipeline: IndexingPipelineResult
): PythonPackResult {
  const imports = new Map<string, Set<string>>();
  const fanIn = new Map<string, number>();
  const fanOut = new Map<string, number>();
  const entrypoints = new Set<string>();
  const testFiles = new Set<string>();
  const complexity = new Map<string, number>();
  const loc = new Map<string, number>();
  const maxNesting = new Map<string, number>();
  const testProximity = new Map<string, number>();
  const warnings: string[] = [];

  const files = Array.from(pipeline.file_metadata.keys()).filter(
    (f) => path.extname(f) === PY_EXTENSION && !isIgnoredPath(f)
  );

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

  for (const f of files) {
    const n = normalizeRelPath(f);
    if (TEST_PATTERNS.some((p) => p.test(n))) testFiles.add(f);
  }

  for (const ep of detectEntrypoints(files, workspacePath)) {
    entrypoints.add(ep);
  }

  for (const f of files) {
    const fullPath = path.join(workspacePath, f);
    let content: string;
    try {
      content = fs.readFileSync(fullPath, "utf-8");
    } catch {
      imports.set(f, new Set());
      fanOut.set(f, 0);
      complexity.set(f, 0);
      loc.set(f, 0);
      maxNesting.set(f, 0);
      testProximity.set(f, computeTestProximityScore(f, testFiles));
      continue;
    }

    const targets = new Set<string>();
    for (const spec of extractImportSpecifiers(content)) {
      const resolved = resolveImport(f, spec, workspacePath, packageRoots, fileSet);
      if (resolved && pipeline.file_metadata.has(resolved) && !isIgnoredPath(resolved)) {
        targets.add(resolved);
      }
    }
    imports.set(f, targets);
    fanOut.set(f, targets.size);
    for (const t of targets) {
      fanIn.set(t, (fanIn.get(t) ?? 0) + 1);
    }

    const complexitySignals = computeComplexitySignals(content);
    complexity.set(f, complexitySignals.score);
    loc.set(f, complexitySignals.loc);
    maxNesting.set(f, complexitySignals.maxNesting);
    testProximity.set(f, computeTestProximityScore(f, testFiles));
  }

  for (const f of files) {
    if (!fanIn.has(f)) fanIn.set(f, 0);
  }

  const { architecture, warnings: archWarnings } = buildReducedArchitecture(files, imports);
  warnings.push(...archWarnings);

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
