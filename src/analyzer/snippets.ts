import fs from "fs";
import path from "path";

const MAX_SNIPPET_CHARS = 300;
const MAX_LINES = 5;

const SECRET_PATTERNS = [/\.env$/i, /secret/i, /password/i, /api[_-]?key/i];

export function readSnippet(
  workspacePath: string,
  relPath: string,
  lineStart = 1,
  lineCount = MAX_LINES
): { line_start: number; line_end: number; snippet: string } | null {
  if (SECRET_PATTERNS.some((p) => p.test(relPath))) return null;
  const full = path.join(workspacePath, relPath);
  if (!fs.existsSync(full)) return null;
  try {
    const lines = fs.readFileSync(full, "utf-8").split("\n");
    const start = Math.max(0, lineStart - 1);
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
