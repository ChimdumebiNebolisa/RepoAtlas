/** Workspace package discovery without traversing outside the extracted root. */

import fs from "fs";
import path from "path";
import { normalizeRelPath } from "../semanticGraph";
import {
  existsDir,
  existsFile,
  readJson,
  type WorkspacePackage,
} from "./tsjsResolveShared";

function expandWorkspaceGlob(workspacePath: string, pattern: string): string[] {
  // Support npm/pnpm-style globs like "packages/*" only (single * segment).
  const normalized = pattern.replace(/\\/g, "/").replace(/\/$/, "");
  if (!normalized.includes("*")) {
    const abs = path.join(workspacePath, normalized);
    return existsDir(abs) ? [normalizeRelPath(normalized)] : [];
  }
  const star = normalized.indexOf("*");
  const prefix = normalized.slice(0, star);
  const suffix = normalized.slice(star + 1);
  if (suffix.includes("*")) return [];
  const parentAbs = path.join(workspacePath, prefix);
  if (!existsDir(parentAbs)) return [];
  return fs
    .readdirSync(parentAbs, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) =>
      normalizeRelPath(path.join(prefix, entry.name + suffix.replace(/^\//, "")))
    )
    .filter((rel) => existsDir(path.join(workspacePath, rel)));
}

function readWorkspacePatterns(workspacePath: string): string[] {
  const patterns: string[] = [];
  const pkg = readJson(path.join(workspacePath, "package.json")) as {
    workspaces?: string[] | { packages?: string[] };
  } | null;
  if (pkg?.workspaces) {
    if (Array.isArray(pkg.workspaces)) patterns.push(...pkg.workspaces);
    else if (Array.isArray(pkg.workspaces.packages)) {
      patterns.push(...pkg.workspaces.packages);
    }
  }

  const pnpmPath = path.join(workspacePath, "pnpm-workspace.yaml");
  if (fs.existsSync(pnpmPath)) {
    try {
      const lines = fs.readFileSync(pnpmPath, "utf-8").split(/\r?\n/);
      let inPackages = false;
      for (const line of lines) {
        if (/^packages\s*:/.test(line)) {
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
      roots.add(root === "" ? "." : root);
    }
  }

  const packages: WorkspacePackage[] = [];
  for (const rootRel of Array.from(roots).sort((a, b) => a.localeCompare(b))) {
    const packageJsonRel =
      rootRel === "." ? "package.json" : `${rootRel}/package.json`;
    const abs = path.join(workspacePath, packageJsonRel);
    if (!existsFile(abs)) continue;
    const pkg = readJson(abs) as { name?: string } | null;
    if (!pkg?.name || typeof pkg.name !== "string") continue;
    packages.push({
      name: pkg.name,
      rootRel: rootRel === "." ? "." : normalizeRelPath(rootRel),
      packageJsonRel: normalizeRelPath(packageJsonRel),
    });
  }
  return packages;
}
