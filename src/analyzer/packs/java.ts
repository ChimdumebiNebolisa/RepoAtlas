/**
 * Java language pack: import extraction, entrypoints, test proximity, complexity proxy.
 */

import fs from "fs";
import path from "path";
import type { Architecture } from "@/types/report";
import type { IndexingPipelineResult } from "../pipeline";

const JAVA_EXTENSION = ".java";
const IGNORED_DIRS = new Set([
  "target",
  "build",
  ".gradle",
  ".idea",
  "out",
  "bin",
  ".settings",
  ".classpath",
  ".project",
]);

const PACKAGE_RE = /^\s*package\s+([\w.]+)\s*;/m;
const IMPORT_RE = /^\s*import\s+(?:static\s+)?([\w.]+(?:\.\*)?)\s*;/gm;
const MAIN_METHOD_RE =
  /public\s+static\s+void\s+main\s*\(\s*String\s*\[\s*\]\s+\w+\s*\)/;
const SPRING_BOOT_APP_RE = /@SpringBootApplication/;
const SPRING_RUN_RE = /SpringApplication\.run\s*\(/;
const SPRING_CONTROLLER_RE = /@(RestController|Controller)\b/;
const REQUEST_MAPPING_RE = /@RequestMapping\b/;
const JAXRS_RE = /@(Path|GET|POST|PUT|DELETE|PATCH)\b/;

const TEST_PATTERNS = [
  /Test\.java$/,
  /IT\.java$/,
  /Tests\.java$/,
  /TestCase\.java$/,
];

const JAVA_COMPLEXITY_RE =
  /\b(if|else|switch|case|for|while|do|catch|&&|\|\||\?)\b/g;

const ARCH_NODE_CAP = 50;
const ARCH_EDGE_CAP = 200;

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

function normalizeRelPath(relPath: string): string {
  return relPath.replace(/\\/g, "/");
}

function isIgnoredPath(relPath: string): boolean {
  const normalized = normalizeRelPath(relPath);
  const segments = normalized.split("/");
  return segments.some((segment) => IGNORED_DIRS.has(segment));
}

/** Detect Maven modules from pom.xml */
function detectMavenModules(workspacePath: string): string[] {
  const modules: string[] = [];
  const rootPom = path.join(workspacePath, "pom.xml");
  if (!fs.existsSync(rootPom)) return modules;

  try {
    const content = fs.readFileSync(rootPom, "utf-8");
    const moduleRe = /<module>([^<]+)<\/module>/g;
    let match: RegExpExecArray | null;
    moduleRe.lastIndex = 0;
    while ((match = moduleRe.exec(content))) {
      const mod = match[1].trim();
      if (mod && !modules.includes(mod)) modules.push(mod);
    }
  } catch {
    // ignore parse errors
  }

  return modules;
}

/** Detect Gradle modules from settings.gradle */
function detectGradleModules(workspacePath: string): string[] {
  const modules: string[] = [];
  const candidates = [
    "settings.gradle",
    "settings.gradle.kts",
  ];

  for (const name of candidates) {
    const settingsPath = path.join(workspacePath, name);
    if (!fs.existsSync(settingsPath)) continue;

    try {
      const content = fs.readFileSync(settingsPath, "utf-8");
      const includeRe = /include\s*\(\s*["']([^"']+)["']\s*\)/g;
      let match: RegExpExecArray | null;
      includeRe.lastIndex = 0;
      while ((match = includeRe.exec(content))) {
        const mod = match[1].trim();
        if (mod && !modules.includes(mod)) modules.push(mod);
      }
      break;
    } catch {
      // ignore
    }
  }

  return modules;
}

/** Build FQN index: fully-qualified class name -> file path */
function buildFqnIndex(
  files: string[],
  workspacePath: string
): Map<string, string> {
  const fqnIndex = new Map<string, string>();

  for (const filePath of files) {
    const fullPath = path.join(workspacePath, filePath);
    let content: string;
    try {
      content = fs.readFileSync(fullPath, "utf-8");
    } catch {
      continue;
    }

    const pkgMatch = content.match(PACKAGE_RE);
    const pkg = pkgMatch ? pkgMatch[1].trim() : "";
    const baseName = path.basename(filePath, ".java");
    const fqn = pkg ? `${pkg}.${baseName}` : baseName;

    fqnIndex.set(fqn, filePath);
  }

  return fqnIndex;
}

/** Extract package-qualified imports from Java source */
export function extractImportSpecifiers(content: string): string[] {
  const specs: string[] = [];
  const seen = new Set<string>();
  let match: RegExpExecArray | null;

  IMPORT_RE.lastIndex = 0;
  while ((match = IMPORT_RE.exec(content))) {
    const spec = match[1].trim();
    if (spec && !seen.has(spec)) {
      seen.add(spec);
      specs.push(spec);
    }
  }

  return specs;
}

/** Resolve Java import to repo file path using FQN index */
function resolveImport(
  importSpec: string,
  fqnIndex: Map<string, string>,
  packageToFiles: Map<string, string[]>
): string[] {
  const targets: string[] = [];

  if (importSpec.endsWith(".*")) {
    const pkg = importSpec.slice(0, -2);
    const files = packageToFiles.get(pkg);
    if (files) targets.push(...files);
    return targets;
  }

  const resolved = fqnIndex.get(importSpec);
  if (resolved) targets.push(resolved);
  return targets;
}

/** Build package -> file paths map */
function buildPackageToFilesMap(
  files: string[],
  workspacePath: string
): Map<string, string[]> {
  const map = new Map<string, string[]>();

  for (const filePath of files) {
    const fullPath = path.join(workspacePath, filePath);
    let content: string;
    try {
      content = fs.readFileSync(fullPath, "utf-8");
    } catch {
      continue;
    }

    const pkgMatch = content.match(PACKAGE_RE);
    const pkg = pkgMatch ? pkgMatch[1].trim() : "";

    const list = map.get(pkg) ?? [];
    list.push(filePath);
    map.set(pkg, list);
  }

  return map;
}

function detectEntrypoints(
  files: string[],
  workspacePath: string
): { entrypoints: Set<string>; warnings: string[] } {
  const entrypoints = new Set<string>();
  const mainClasses: string[] = [];
  const warnings: string[] = [];

  for (const filePath of files) {
    const fullPath = path.join(workspacePath, filePath);
    let content: string;
    try {
      content = fs.readFileSync(fullPath, "utf-8");
    } catch {
      continue;
    }

    if (SPRING_BOOT_APP_RE.test(content) || SPRING_RUN_RE.test(content)) {
      entrypoints.add(filePath);
    } else if (SPRING_CONTROLLER_RE.test(content) || REQUEST_MAPPING_RE.test(content)) {
      entrypoints.add(filePath);
    } else if (JAXRS_RE.test(content)) {
      entrypoints.add(filePath);
    } else if (MAIN_METHOD_RE.test(content)) {
      mainClasses.push(filePath);
      entrypoints.add(filePath);
    }
  }

  if (mainClasses.length > 1) {
    warnings.push(
      `Multiple main() entrypoints detected: ${mainClasses.slice(0, 5).join(", ")}${mainClasses.length > 5 ? "..." : ""}`
    );
  }

  return { entrypoints, warnings };
}

function computeTestProximityScore(
  prodFile: string,
  testFiles: Set<string>
): number {
  const normFile = normalizeRelPath(prodFile);
  const normTestFiles = new Set([...testFiles].map(normalizeRelPath));

  if (normTestFiles.has(normFile)) return 100;

  const baseName = path.basename(normFile, ".java");
  const fileDir = path.posix.dirname(normFile);

  for (const normTest of normTestFiles) {
    const testDir = path.posix.dirname(normTest);

    if (testDir === fileDir) {
      const testBase = path.basename(normTest, ".java");
      if (
        testBase === `${baseName}Test` ||
        testBase === `${baseName}Tests` ||
        testBase === `${baseName}TestCase`
      )
        return 100;
      if (testBase === `${baseName}IT`) return 90;
      return 80;
    }
  }

  const mainJavaMatch = normFile.match(/^(.*)src[\/\\]main[\/\\]java[\/\\](.+)$/);
  if (!mainJavaMatch) return 0;

  const [, prefix, relPath] = mainJavaMatch;
  const pkgDir = path.posix.dirname(relPath.replace(/\\/g, "/"));
  const testDir = `${(prefix || "").replace(/\\/g, "/")}src/test/java/${pkgDir}`;

  const testPath = `${testDir}/${baseName}Test.java`.replace(/\/+/g, "/");
  if (normTestFiles.has(testPath)) return 100;

  const itPath = `${testDir}/${baseName}IT.java`;
  if (normTestFiles.has(itPath)) return 90;

  const testsPath = `${testDir}/${baseName}Tests.java`;
  if (normTestFiles.has(testsPath)) return 100;

  for (const normTest of normTestFiles) {
    const testPackageDir = normTest
      .replace(/\/src\/test\/java\//, "/")
      .replace(/\/[^/]+\.java$/, "")
      .replace(/\\/g, "/");
    const prodPackageDir = normFile
      .replace(/\/src\/main\/java\//, "/")
      .replace(/\/[^/]+\.java$/, "");
    if (testPackageDir === prodPackageDir) return 80;
  }

  return 0;
}

export function computeComplexitySignals(content: string): {
  loc: number;
  branchCount: number;
  maxNesting: number;
  score: number;
} {
  const lines = content.split(/\r?\n/);
  const loc = lines.filter((line) => {
    const trimmed = line.trim();
    return (
      trimmed.length > 0 &&
      !trimmed.startsWith("//") &&
      !trimmed.startsWith("/*") &&
      !trimmed.startsWith("*")
    );
  }).length;

  const branchMatches = content.match(JAVA_COMPLEXITY_RE);
  const branchCount = branchMatches ? branchMatches.length : 0;

  let currentDepth = 0;
  let maxNesting = 0;
  for (const ch of content) {
    if (ch === "{") {
      currentDepth += 1;
      if (currentDepth > maxNesting) maxNesting = currentDepth;
    } else if (ch === "}") {
      currentDepth = Math.max(0, currentDepth - 1);
    }
  }

  const score = branchCount * 3 + maxNesting * 2 + Math.round(loc / 40);
  return { loc, branchCount, maxNesting, score };
}

function toPackagePath(filePath: string): string {
  const normalized = normalizeRelPath(filePath);
  const match = normalized.match(/src\/(?:main|test)\/java\/(.+)\/[^/]+\.java$/);
  if (match) {
    return match[1].replace(/\//g, ".");
  }
  const dir = path.posix.dirname(normalized);
  return dir === "." ? "." : dir.replace(/\//g, ".");
}

function buildReducedArchitecture(
  files: string[],
  imports: Map<string, Set<string>>
): { architecture: Architecture; warnings: string[] } {
  const warnings: string[] = [];
  const packageFileCounts = new Map<string, number>();

  for (const file of files) {
    const pkg = toPackagePath(file);
    packageFileCounts.set(pkg, (packageFileCounts.get(pkg) ?? 0) + 1);
  }

  const edgeWeights = new Map<string, number>();
  for (const [fromFile, toFiles] of imports) {
    const fromPkg = toPackagePath(fromFile);
    for (const toFile of toFiles) {
      const toPkg = toPackagePath(toFile);
      const key = `${fromPkg}=>${toPkg}`;
      edgeWeights.set(key, (edgeWeights.get(key) ?? 0) + 1);
    }
  }

  const packageDegree = new Map<string, number>();
  for (const [edgeKey, weight] of edgeWeights) {
    const [from, to] = edgeKey.split("=>");
    packageDegree.set(from, (packageDegree.get(from) ?? 0) + weight);
    packageDegree.set(to, (packageDegree.get(to) ?? 0) + weight);
  }
  for (const pkg of packageFileCounts.keys()) {
    if (!packageDegree.has(pkg)) packageDegree.set(pkg, 0);
  }

  const sortedPackages = Array.from(packageFileCounts.keys()).sort((a, b) => {
    const degreeDelta = (packageDegree.get(b) ?? 0) - (packageDegree.get(a) ?? 0);
    if (degreeDelta !== 0) return degreeDelta;
    const fileCountDelta =
      (packageFileCounts.get(b) ?? 0) - (packageFileCounts.get(a) ?? 0);
    if (fileCountDelta !== 0) return fileCountDelta;
    return a.localeCompare(b);
  });

  const selectedPackages = sortedPackages.slice(0, ARCH_NODE_CAP);
  if (sortedPackages.length > ARCH_NODE_CAP) {
    warnings.push(
      `Architecture nodes capped at ${ARCH_NODE_CAP} packages (from ${sortedPackages.length}).`
    );
  }

  if (files.length > selectedPackages.length) {
    warnings.push(
      `Architecture reduced from file-level (${files.length} files) to package-level (${selectedPackages.length} packages).`
    );
  }

  const selectedPackageSet = new Set(selectedPackages);
  const edges = Array.from(edgeWeights.entries())
    .map(([edgeKey, weight]) => {
      const [from, to] = edgeKey.split("=>");
      return { from, to, weight };
    })
    .filter(
      (edge) =>
        selectedPackageSet.has(edge.from) && selectedPackageSet.has(edge.to)
    )
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
    return selectedPackageSet.has(from) && selectedPackageSet.has(to);
  }).length;
  if (fullEdgeCount > ARCH_EDGE_CAP) {
    warnings.push(
      `Architecture edges capped at ${ARCH_EDGE_CAP} links (from ${fullEdgeCount}).`
    );
  }

  const nodes = selectedPackages.map((pkg) => ({
    id: pkg,
    label: pkg,
    type: "folder" as const,
  }));

  return { architecture: { nodes, edges }, warnings };
}

export function runJavaPack(
  workspacePath: string,
  pipeline: IndexingPipelineResult
): JavaPackResult {
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
    (f) =>
      path.extname(f) === JAVA_EXTENSION &&
      !isIgnoredPath(f) &&
      !f.includes("/target/") &&
      !f.includes("/build/")
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

  detectMavenModules(workspacePath);
  detectGradleModules(workspacePath);

  const fqnIndex = buildFqnIndex(files, workspacePath);
  const packageToFiles = buildPackageToFilesMap(files, workspacePath);

  for (const f of files) {
    const n = normalizeRelPath(f);
    if (TEST_PATTERNS.some((p) => p.test(n))) testFiles.add(f);
  }

  const { entrypoints: eps, warnings: epWarnings } = detectEntrypoints(
    files,
    workspacePath
  );
  for (const ep of eps) entrypoints.add(ep);
  warnings.push(...epWarnings);

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
      const resolved = resolveImport(spec, fqnIndex, packageToFiles);
      for (const r of resolved) {
        if (
          pipeline.file_metadata.has(r) &&
          !isIgnoredPath(r) &&
          r !== f
        ) {
          targets.add(r);
        }
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

  const { architecture, warnings: archWarnings } = buildReducedArchitecture(
    files,
    imports
  );
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
