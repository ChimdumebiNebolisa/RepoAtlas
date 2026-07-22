import fs from "fs";
import path from "path";
import { normalizeRelPath } from "../semanticGraph";

export const RESOLUTION_EXTENSIONS = [
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
  ".d.ts",
];

export const INDEX_NAMES = [
  "index.ts",
  "index.tsx",
  "index.js",
  "index.jsx",
  "index.mjs",
  "index.cjs",
];

export interface WorkspacePackage {
  name: string;
  rootRel: string;
  packageJsonRel: string;
}

export type ResolveReason =
  | "module_not_found"
  | "non_literal_specifier"
  | "outside_workspace"
  | "unsupported_package_exports"
  | "parse_failed"
  | "ignored_path";

export type ResolveOutcome =
  | { status: "resolved_internal"; relPath: string }
  | { status: "resolved_external"; packageName: string }
  | { status: "unresolved"; reason: ResolveReason }
  | { status: "ignored"; reason: ResolveReason };

export function existsFile(abs: string): boolean {
  try {
    return fs.existsSync(abs) && fs.statSync(abs).isFile();
  } catch {
    return false;
  }
}

export function existsDir(abs: string): boolean {
  try {
    return fs.existsSync(abs) && fs.statSync(abs).isDirectory();
  } catch {
    return false;
  }
}

export function readJson(abs: string): unknown | null {
  try {
    return JSON.parse(fs.readFileSync(abs, "utf-8"));
  } catch {
    return null;
  }
}

export function packageNameFromSpecifier(specifier: string): string | null {
  if (specifier.startsWith(".") || specifier.startsWith("/")) return null;
  if (specifier.startsWith("@")) {
    const parts = specifier.split("/");
    if (parts.length < 2) return null;
    return `${parts[0]}/${parts[1]}`;
  }
  return specifier.split("/")[0] || null;
}

export function absToWorkspaceRel(
  workspacePath: string,
  absPath: string
): string | null {
  const root = path.resolve(workspacePath);
  const abs = path.resolve(absPath);
  const rel = path.relative(root, abs);
  if (rel.startsWith("..") || path.isAbsolute(rel)) return null;
  return normalizeRelPath(rel);
}
