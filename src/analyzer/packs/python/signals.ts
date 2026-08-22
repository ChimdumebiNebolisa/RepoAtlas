import path from "path";
import { normalizeRelPath } from "./shared";

const TEST_PATTERNS = [
  /(^|\/)test_[^/]*\.py$/i,
  /_test\.py$/i,
  /(^|\/)tests?\//,
];
// Decision-point definition aligned with the TS/JS AST pack: `else` is not a
// new decision and `try`/`finally`/`with` introduce no branch of their own
// (`except` is the branch, mirroring TS catch clauses).
const COMPLEXITY_RE =
  /\b(if|elif|for|while|except|and|or|match|case)\b/g;
const STRING_PREFIX_RE = /(?:^|[^\w])([rRuUbBfF]{1,3})$/;

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
    const matchesFileName =
      stripTestSuffix(path.posix.basename(normalizedTest)) ===
      path.posix.basename(normalizedFile);

    if (testDir === fileDir && matchesFileName) {
      best = Math.max(best, 100);
      continue;
    }
    if (
      matchesFileName &&
      (testDir === `${fileDir}/__tests__` || normalizedTest.startsWith(`${fileDir}/__tests__/`))
    ) {
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
  const code = stripPythonCommentsAndStrings(content);
  const lines = code.split(/\r?\n/);
  const loc = lines.filter((line) => line.trim().length > 0).length;
  const branchCount = code.match(COMPLEXITY_RE)?.length ?? 0;

  let maxNesting = 0;
  for (const line of lines) {
    if (line.trim().length === 0) continue;
    const leadingSpaces = line.match(/^(\s*)/)?.[1].length ?? 0;
    maxNesting = Math.max(maxNesting, Math.floor(leadingSpaces / 4));
  }

  const score = branchCount * 3 + maxNesting * 2 + Math.round(loc / 40);
  return { loc, branchCount, maxNesting, score };
}

export function stripPythonCommentsAndStrings(content: string): string {
  const output: string[] = Array.from(content, (character) =>
    character === "\n" || character === "\r" ? character : " "
  );
  let quote: "'" | '"' | null = null;
  let tripleQuoted = false;

  for (let index = 0; index < content.length; index += 1) {
    const character = content[index];

    if (quote) {
      if (character === "\\") {
        const next = content[index + 1];
        if (next !== undefined) {
          if (next === "\n" || next === "\r") output[index + 1] = next;
          index += 1;
        }
        continue;
      }

      if (
        tripleQuoted &&
        character === quote &&
        content[index + 1] === quote &&
        content[index + 2] === quote
      ) {
        index += 2;
        quote = null;
        tripleQuoted = false;
        continue;
      }

      if (!tripleQuoted && character === quote) {
        quote = null;
        continue;
      }

      if (!tripleQuoted && (character === "\n" || character === "\r")) {
        quote = null;
      }
      continue;
    }

    if (character === "#") {
      while (
        index + 1 < content.length &&
        content[index + 1] !== "\n" &&
        content[index + 1] !== "\r"
      ) {
        index += 1;
      }
      continue;
    }

    if (character !== "'" && character !== '"') {
      output[index] = character;
      continue;
    }

    const prefix = content.slice(0, index).match(STRING_PREFIX_RE)?.[1];
    if (prefix) {
      for (let prefixIndex = index - prefix.length; prefixIndex < index; prefixIndex += 1) {
        output[prefixIndex] = " ";
      }
    }

    quote = character;
    tripleQuoted =
      content[index + 1] === character && content[index + 2] === character;
    if (tripleQuoted) index += 2;
  }

  return output.join("");
}
