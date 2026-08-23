import fs from "fs";

export const JAVA_EXTENSION = ".java";
const PACKAGE_RE = /^\s*package\s+([\w.]+)\s*;/m;

export function stripJavaCommentsAndLiterals(content: string): string {
  const output: string[] = Array.from(content, (character) =>
    character === "\n" || character === "\r" ? character : " "
  );
  let state:
    | "code"
    | "line-comment"
    | "block-comment"
    | "string"
    | "character"
    | "text-block" = "code";

  for (let index = 0; index < content.length; index += 1) {
    const character = content[index];
    const next = content[index + 1];

    if (state === "line-comment") {
      if (character === "\n" || character === "\r") {
        output[index] = character;
        state = "code";
      }
      continue;
    }

    if (state === "block-comment") {
      if (character === "*" && next === "/") {
        index += 1;
        state = "code";
      }
      continue;
    }

    if (state === "text-block") {
      if (
        character === '"' &&
        next === '"' &&
        content[index + 2] === '"' &&
        !isEscaped(content, index)
      ) {
        index += 2;
        state = "code";
      }
      continue;
    }

    if (state === "string" || state === "character") {
      const delimiter = state === "string" ? '"' : "'";
      if (character === "\\") {
        if (next !== undefined) {
          if (next === "\n" || next === "\r") output[index + 1] = next;
          index += 1;
        }
        continue;
      }
      if (character === delimiter) state = "code";
      if (character === "\n" || character === "\r") {
        output[index] = character;
        state = "code";
      }
      continue;
    }

    if (character === "/" && next === "/") {
      index += 1;
      state = "line-comment";
      continue;
    }
    if (character === "/" && next === "*") {
      index += 1;
      state = "block-comment";
      continue;
    }
    if (
      character === '"' &&
      next === '"' &&
      content[index + 2] === '"'
    ) {
      index += 2;
      state = "text-block";
      continue;
    }
    if (character === '"') {
      state = "string";
      continue;
    }
    if (character === "'") {
      state = "character";
      continue;
    }
    output[index] = character;
  }

  return output.join("");
}

function isEscaped(content: string, index: number): boolean {
  let backslashes = 0;
  for (
    let cursor = index - 1;
    cursor >= 0 && content[cursor] === "\\";
    cursor -= 1
  ) {
    backslashes += 1;
  }
  return backslashes % 2 === 1;
}

export function normalizeJavaPath(relPath: string): string {
  return relPath.replace(/\\/g, "/");
}

export function readJavaSource(
  workspacePath: string,
  filePath: string
): string | null {
  try {
    return fs.readFileSync(`${workspacePath}/${normalizeJavaPath(filePath)}`, "utf-8");
  } catch {
    return null;
  }
}

export function packageNameFromSource(content: string): string {
  const match = stripJavaCommentsAndLiterals(content).match(PACKAGE_RE);
  return match ? match[1].trim() : "";
}
