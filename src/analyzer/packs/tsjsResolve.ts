/** Focused coordinator for deterministic TypeScript and JavaScript imports. */

import { normalizeRelPath } from "../semanticGraph";
import { createCompilerResolver } from "./tsjsResolveCompiler";
import { createWorkspacePackageResolver } from "./tsjsResolvePackages";
import {
  packageNameFromSpecifier,
  type ResolveOutcome,
  type ResolveReason,
  type WorkspacePackage,
} from "./tsjsResolveShared";
import { discoverWorkspacePackages } from "./tsjsResolveWorkspaces";

export type { ResolveOutcome, ResolveReason, WorkspacePackage };
export { discoverWorkspacePackages };

export interface TsJsResolver {
  resolve(fromRelFile: string, specifier: string): ResolveOutcome;
  workspacePackages: WorkspacePackage[];
  warnings: string[];
}

export function createTsJsResolver(
  workspacePath: string,
  fileIndex: Set<string>,
  isIgnored: (relPath: string) => boolean
): TsJsResolver {
  const workspacePackages = discoverWorkspacePackages(workspacePath);
  const findIndexedFile = (relPath: string): string | null => {
    const normalized = normalizeRelPath(relPath);
    if (fileIndex.has(normalized) && !isIgnored(normalized)) return normalized;
    for (const candidate of fileIndex) {
      if (normalizeRelPath(candidate) === normalized && !isIgnored(candidate)) {
        return candidate;
      }
    }
    return null;
  };

  const compiler = createCompilerResolver({
    workspacePath,
    isIgnored,
    findIndexedFile,
  });
  const resolveWorkspacePackage = createWorkspacePackageResolver({
    workspacePath,
    packages: workspacePackages,
    isIgnored,
    findIndexedFile,
  });

  return {
    workspacePackages,
    warnings: [...compiler.warnings],
    resolve(fromRelFile: string, specifier: string): ResolveOutcome {
      if (!specifier) {
        return { status: "unresolved", reason: "non_literal_specifier" };
      }
      const workspaceOutcome = resolveWorkspacePackage(specifier);
      if (workspaceOutcome) return workspaceOutcome;
      if (specifier.startsWith(".") || specifier.startsWith("/")) {
        return compiler.resolve(fromRelFile, specifier);
      }

      const aliased = compiler.resolve(fromRelFile, specifier);
      if (aliased.status === "resolved_internal" || aliased.status === "ignored") {
        return aliased;
      }
      const packageName = packageNameFromSpecifier(specifier);
      return packageName
        ? { status: "resolved_external", packageName }
        : { status: "unresolved", reason: "module_not_found" };
    },
  };
}
