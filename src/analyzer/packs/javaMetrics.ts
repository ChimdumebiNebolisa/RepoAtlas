import path from "path";
import { JAVA_EXTENSION, normalizeJavaPath, readJavaSource } from "./javaShared";

const JAVA_COMPLEXITY_RE =
  /\b(if|else|switch|case|for|while|do|catch|&&|\|\||\?)\b/g;

export interface JavaMetrics {
  complexity: Map<string, number>;
  loc: Map<string, number>;
  maxNesting: Map<string, number>;
  testProximity: Map<string, number>;
}

export function computeComplexitySignals(content: string): {
  loc: number;
  branchCount: number;
  maxNesting: number;
  score: number;
} {
  const loc = content.split(/\r?\n/).filter((line) => {
    const trimmed = line.trim();
    return (
      trimmed.length > 0 &&
      !trimmed.startsWith("//") &&
      !trimmed.startsWith("/*") &&
      !trimmed.startsWith("*")
    );
  }).length;
  const branchCount = content.match(JAVA_COMPLEXITY_RE)?.length ?? 0;
  let currentDepth = 0;
  let maxNesting = 0;
  for (const character of content) {
    if (character === "{") {
      currentDepth += 1;
      maxNesting = Math.max(maxNesting, currentDepth);
    } else if (character === "}") {
      currentDepth = Math.max(0, currentDepth - 1);
    }
  }
  const score = branchCount * 3 + maxNesting * 2 + Math.round(loc / 40);
  return { loc, branchCount, maxNesting, score };
}

export function computeTestProximityScore(
  prodFile: string,
  testFiles: Set<string>
): number {
  const normalizedFile = normalizeJavaPath(prodFile);
  const normalizedTests = new Set([...testFiles].map(normalizeJavaPath));
  if (normalizedTests.has(normalizedFile)) return 100;

  const baseName = path.basename(normalizedFile, JAVA_EXTENSION);
  const fileDir = path.posix.dirname(normalizedFile);
  for (const testFile of normalizedTests) {
    if (path.posix.dirname(testFile) !== fileDir) continue;
    const testBase = path.basename(testFile, JAVA_EXTENSION);
    if ([`${baseName}Test`, `${baseName}Tests`, `${baseName}TestCase`].includes(testBase)) {
      return 100;
    }
    if (testBase === `${baseName}IT`) return 90;
    return 80;
  }

  const mainMatch = normalizedFile.match(/^(.*)src\/main\/java\/(.+)$/);
  if (!mainMatch) return 0;
  const [, prefix, relativePath] = mainMatch;
  const packageDir = path.posix.dirname(relativePath);
  const testDir = `${prefix || ""}src/test/java/${packageDir}`;
  if (normalizedTests.has(`${testDir}/${baseName}Test.java`)) return 100;
  if (normalizedTests.has(`${testDir}/${baseName}IT.java`)) return 90;
  if (normalizedTests.has(`${testDir}/${baseName}Tests.java`)) return 100;

  const productPackageDir = normalizedFile
    .replace(/\/src\/main\/java\//, "/")
    .replace(/\/[^/]+\.java$/, "");
  for (const testFile of normalizedTests) {
    const testPackageDir = testFile
      .replace(/\/src\/test\/java\//, "/")
      .replace(/\/[^/]+\.java$/, "");
    if (testPackageDir === productPackageDir) return 80;
  }
  return 0;
}

export function computeJavaMetrics(
  files: string[],
  workspacePath: string,
  testFiles: Set<string>
): JavaMetrics {
  const complexity = new Map<string, number>();
  const loc = new Map<string, number>();
  const maxNesting = new Map<string, number>();
  const testProximity = new Map<string, number>();
  for (const filePath of files) {
    const content = readJavaSource(workspacePath, filePath);
    const signals = content === null
      ? { loc: 0, branchCount: 0, maxNesting: 0, score: 0 }
      : computeComplexitySignals(content);
    complexity.set(filePath, signals.score);
    loc.set(filePath, signals.loc);
    maxNesting.set(filePath, signals.maxNesting);
    testProximity.set(filePath, computeTestProximityScore(filePath, testFiles));
  }
  return { complexity, loc, maxNesting, testProximity };
}
