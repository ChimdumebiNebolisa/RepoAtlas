import fs from "fs";
import path from "path";

const MAX_SNIPPET_CHARS = 300;
const MAX_LINES = 5;

const SECRET_PATTERNS = [
  /\.env(?:\.|$)/i,
  /\.envrc$/i,
  /secret/i,
  /password/i,
  /api[_-]?key/i,
];

function isContainedPath(root: string, candidate: string): boolean {
  const relative = path.relative(root, candidate);
  return (
    relative !== "" &&
    relative !== ".." &&
    !relative.startsWith(`..${path.sep}`) &&
    !path.isAbsolute(relative)
  );
}

function safeSnippetPath(
  workspacePath: string,
  relPath: string
): string | null {
  if (!workspacePath || !relPath || path.isAbsolute(relPath)) return null;

  let workspaceRoot: string;
  try {
    workspaceRoot = fs.realpathSync(workspacePath);
  } catch {
    return null;
  }

  const fullPath = path.resolve(workspaceRoot, relPath);
  if (!isContainedPath(workspaceRoot, fullPath)) return null;

  const relative = path.relative(workspaceRoot, fullPath);
  const segments = relative.split(path.sep);
  let currentPath = workspaceRoot;

  try {
    for (const [index, segment] of segments.entries()) {
      currentPath = path.join(currentPath, segment);
      const stats = fs.lstatSync(currentPath);
      if (stats.isSymbolicLink()) return null;

      const isFile = index === segments.length - 1;
      if (isFile ? !stats.isFile() : !stats.isDirectory()) return null;
    }
  } catch {
    return null;
  }

  return fullPath;
}

function isValidLineRequest(lineStart: number, lineCount: number): boolean {
  return (
    Number.isSafeInteger(lineStart) &&
    lineStart >= 1 &&
    Number.isSafeInteger(lineCount) &&
    lineCount >= 1 &&
    lineCount <= MAX_LINES
  );
}

export function readSnippet(
  workspacePath: string,
  relPath: string,
  lineStart = 1,
  lineCount = MAX_LINES
): { line_start: number; line_end: number; snippet: string } | null {
  if (SECRET_PATTERNS.some((p) => p.test(relPath))) return null;
  if (!isValidLineRequest(lineStart, lineCount)) return null;
  const full = safeSnippetPath(workspacePath, relPath);
  if (!full) return null;

  try {
    const lines = fs.readFileSync(full, "utf-8").split("\n");
    const start = lineStart - 1;
    const slice = lines.slice(start, start + lineCount);
    let snippet = slice.join("\n").trim();
    if (snippet.length > MAX_SNIPPET_CHARS) {
      snippet = snippet.slice(0, MAX_SNIPPET_CHARS) + "…";
    }
    if (!snippet) return null;
    return {
      line_start: start + 1,
      line_end: start + slice.length,
      snippet,
    };
  } catch {
    return null;
  }
}

export function readFileHeaderSnippet(
  workspacePath: string,
  relPath: string
): { line_start: number; line_end: number; snippet: string } | null {
  return readSnippet(workspacePath, relPath, 1, MAX_LINES);
}
