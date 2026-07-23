import fs from "fs";

export const JAVA_EXTENSION = ".java";
export const PACKAGE_RE = /^\s*package\s+([\w.]+)\s*;/m;

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
  const match = content.match(PACKAGE_RE);
  return match ? match[1].trim() : "";
}
