/** Workspace package discovery without traversing outside the extracted root. */

import fs from "fs";
import path from "path";
import { normalizeRelPath } from "../semanticGraph";
import {
  absToWorkspaceRel,
  existsDir,
  existsFile,
  packageNameFromSpecifier,
  readJson,
  type WorkspacePackage,
} from "./tsjsResolveShared";

function normalizeWorkspacePattern(pattern: string): string | null {
  const normalized = pattern.replace(/\\/g, "/").replace(/\/+$/, "");
  if (
    !normalized ||
    normalized !== normalized.trim() ||
    normalized.includes("\0") ||
    path.isAbsolute(normalized) ||
    /^[a-zA-Z]:\//.test(normalized)
  ) {
    return null;
  }

  const segments = normalized.split("/");
  if (
    segments.some((segment) => !segment || segment === "." || segment === "..")
  ) {
    return null;
  }
  const starSegments = segments.filter((segment) => segment === "*");
  if (
    segments.some((segment) => segment.includes("*") && segment !== "*") ||
    starSegments.length > 1
  ) {
    return null;
  }
  return normalized;
}

function containedDirectoryRel(
  workspacePath: string,
  candidatePath: string
): string | null {
  const lexicalRel = absToWorkspaceRel(workspacePath, candidatePath);
  if (lexicalRel === null || !existsDir(candidatePath)) return null;
  try {
    const realWorkspace = fs.realpathSync(workspacePath);
    const realCandidate = fs.realpathSync(candidatePath);
    return absToWorkspaceRel(realWorkspace, realCandidate) === null
      ? null
      : lexicalRel;
  } catch {
    return null;
  }
}

function expandWorkspaceGlob(workspacePath: string, pattern: string): string[] {
  // Support npm/pnpm-style globs like "packages/*" only (single * segment).
  const normalized = normalizeWorkspacePattern(pattern);
  if (!normalized) return [];
  if (!normalized.includes("*")) {
    const abs = path.resolve(workspacePath, normalized);
    const rel = containedDirectoryRel(workspacePath, abs);
    return rel === null ? [] : [normalizeRelPath(rel)];
  }
  const segments = normalized.split("/");
  const starIndex = segments.indexOf("*");
  const prefix = segments.slice(0, starIndex);
  const suffix = segments.slice(starIndex + 1);
  const parentAbs = path.resolve(workspacePath, ...prefix);
  if (containedDirectoryRel(workspacePath, parentAbs) === null) return [];

  try {
    return fs
      .readdirSync(parentAbs, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => path.resolve(parentAbs, entry.name, ...suffix))
      .map((candidate) => containedDirectoryRel(workspacePath, candidate))
      .filter((rel): rel is string => rel !== null)
      .map(normalizeRelPath);
  } catch {
    return [];
  }
}

function readWorkspacePatterns(workspacePath: string): string[] {
  const patterns: string[] = [];
  const pkg = readJson(path.join(workspacePath, "package.json")) as {
    workspaces?: unknown;
  } | null;
  const workspaces = pkg?.workspaces;
  const candidates = Array.isArray(workspaces)
    ? workspaces
    : workspaces &&
        typeof workspaces === "object" &&
        Array.isArray((workspaces as { packages?: unknown }).packages)
      ? (workspaces as { packages: unknown[] }).packages
      : [];
  for (const candidate of candidates) {
    if (typeof candidate === "string") {
      patterns.push(candidate);
    }
  }

  const pnpmPath = path.join(workspacePath, "pnpm-workspace.yaml");
  if (fs.existsSync(pnpmPath)) {
    try {
      const lines = fs.readFileSync(pnpmPath, "utf-8").split(/\r?\n/);
      let inPackages = false;
      for (const line of lines) {
        if (/^packages\s*:\s*(?:#.*)?$/.test(line)) {
          inPackages = true;
          continue;
        }
        if (inPackages) {
          if (/^\S/.test(line) && !/^\s*-/.test(line)) break;
          const match = line.match(/^\s*-\s*['"]?([^'"]+)['"]?\s*$/);
          if (match) patterns.push(match[1]);
        }
      }
    } catch {
      // A malformed workspace file must not stop the rest of the analysis.
    }
  }

  return patterns;
}

export function discoverWorkspacePackages(
  workspacePath: string
): WorkspacePackage[] {
  const roots = new Set<string>(["."]);
  for (const pattern of readWorkspacePatterns(workspacePath)) {
    for (const root of expandWorkspaceGlob(workspacePath, pattern)) {
      roots.add(root);
    }
  }

  const packages: WorkspacePackage[] = [];
  for (const rootRel of Array.from(roots).sort((a, b) => a.localeCompare(b))) {
    const packageJsonRel =
      rootRel === "." ? "package.json" : `${rootRel}/package.json`;
    const abs = path.join(workspacePath, packageJsonRel);
    if (!existsFile(abs)) continue;
    const pkg = readJson(abs) as { name?: string } | null;
    if (
      !pkg?.name ||
      typeof pkg.name !== "string" ||
      packageNameFromSpecifier(pkg.name) !== pkg.name
    ) {
      continue;
    }
    packages.push({
      name: pkg.name,
      rootRel: rootRel === "." ? "." : normalizeRelPath(rootRel),
      packageJsonRel: normalizeRelPath(packageJsonRel),
    });
  }
  return packages;
}
