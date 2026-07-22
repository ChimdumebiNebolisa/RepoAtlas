import { shouldSkipPath } from "../../ignoreRules";

export const PY_EXTENSION = ".py";

export function normalizeRelPath(relPath: string): string {
  return relPath.replace(/\\/g, "/");
}

export function isIgnoredPath(relPath: string): boolean {
  return shouldSkipPath(relPath);
}

