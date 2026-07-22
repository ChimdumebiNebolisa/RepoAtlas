import path from "path";
import { normalizeRelPath } from "./shared";

const TEST_PATTERNS = [
  /(^|\/)test_[^/]*\.py$/i,
  /_test\.py$/i,
  /(^|\/)tests?\//,
];
const COMPLEXITY_RE =
  /\b(if|elif|else|for|while|try|except|finally|with|and|or|match|case)\b/g;

function stripExtension(relPath: string): string {
  return relPath.replace(/\.py$/i, "");
}

function stripTestSuffix(relPath: string): string {
  return relPath.replace(/^test_/, "").replace(/_test\.py$/i, ".py");
}

export function detectTestFiles(files: string[]): Set<string> {
  return new Set(
    files.filter((file) => TEST_PATTERNS.some((pattern) => pattern.test(normalizeRelPath(file))))
  );
}

export function computeTestProximityScore(filePath: string, testFiles: Set<string>): number {
  const normalizedFile = normalizeRelPath(filePath);
  if (testFiles.has(filePath)) return 100;

  const fileDir = path.posix.dirname(normalizedFile);
  const strippedFile = stripExtension(normalizedFile);
  const strippedFileSansSrc = stripExtension(normalizedFile.replace(/^src\//, ""));

  let best = 0;
  for (const testFile of testFiles) {
    const normalizedTest = normalizeRelPath(testFile);
    const testDir = path.posix.dirname(normalizedTest);

    if (testDir === fileDir) {
      best = Math.max(best, 100);
      continue;
    }
    if (testDir === `${fileDir}/__tests__` || normalizedTest.startsWith(`${fileDir}/__tests__/`)) {
      best = Math.max(best, 90);
      continue;
    }
    if (normalizedTest.startsWith("tests/") || normalizedTest.startsWith("test/")) {
      const after = normalizedTest.startsWith("tests/")
        ? normalizedTest.slice(6)
        : normalizedTest.slice(5);
      const mirroredStripped = stripExtension(stripTestSuffix(after));
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
  const branchCount = content.match(COMPLEXITY_RE)?.length ?? 0;

  let maxNesting = 0;
  for (const line of lines) {
    if (line.trim().length === 0) continue;
    const leadingSpaces = line.match(/^(\s*)/)?.[1].length ?? 0;
    maxNesting = Math.max(maxNesting, Math.floor(leadingSpaces / 4));
  }

  const score = branchCount * 3 + maxNesting * 2 + Math.round(loc / 40);
  return { loc, branchCount, maxNesting, score };
}

