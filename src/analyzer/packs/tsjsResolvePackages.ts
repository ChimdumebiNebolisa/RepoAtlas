/** Package exports and source-entry recovery for internal workspace imports. */

import path from "path";
import {
  INDEX_NAMES,
  RESOLUTION_EXTENSIONS,
  absToWorkspaceRel,
  existsFile,
  packageNameFromSpecifier,
  readJson,
  type ResolveOutcome,
  type WorkspacePackage,
} from "./tsjsResolveShared";

const EXPORT_CONDITIONS = [
  "import",
  "require",
  "default",
  "module",
  "browser",
  "types",
] as const;

function isSupportedPackageExportTarget(target: unknown): boolean {
  if (typeof target === "string") return true;
  if (!target || typeof target !== "object" || Array.isArray(target)) {
    return false;
  }
  const record = target as Record<string, unknown>;
  return EXPORT_CONDITIONS.some(
    (condition) =>
      condition in record &&
      isSupportedPackageExportTarget(record[condition])
  );
}

function resolvePackageExportTarget(
  packageRoot: string,
  target: unknown
): string | null {
  if (typeof target === "string") {
    const abs = path.normalize(path.join(packageRoot, target));
    const normalizedRoot = path.normalize(packageRoot);
    if (abs !== normalizedRoot && !abs.startsWith(normalizedRoot + path.sep)) {
      return null;
    }
    if (existsFile(abs)) return abs;
    for (const extension of RESOLUTION_EXTENSIONS) {
      if (existsFile(abs + extension)) return abs + extension;
    }
    for (const indexName of INDEX_NAMES) {
      const indexPath = path.join(abs, indexName);
      if (existsFile(indexPath)) return indexPath;
    }
    return null;
  }
  if (target && typeof target === "object" && !Array.isArray(target)) {
    const record = target as Record<string, unknown>;
    for (const key of EXPORT_CONDITIONS) {
      if (key in record) {
        const resolved = resolvePackageExportTarget(packageRoot, record[key]);
        if (resolved) return resolved;
      }
    }
  }
  return null;
}

function resolveViaPackageJson(
  packageRoot: string,
  subpath: string
): { abs: string | null; unsupportedExports: boolean } {
  const pkg = readJson(path.join(packageRoot, "package.json")) as {
    main?: string;
    module?: string;
    types?: string;
    exports?: unknown;
  } | null;
  if (!pkg) return { abs: null, unsupportedExports: false };

  if (pkg.exports != null) {
    const isRootImport = subpath === "" || subpath === ".";
    if (typeof pkg.exports === "string") {
      return isRootImport
        ? {
            abs: resolvePackageExportTarget(packageRoot, pkg.exports),
            unsupportedExports: false,
          }
        : { abs: null, unsupportedExports: true };
    }
    if (pkg.exports && typeof pkg.exports === "object" && !Array.isArray(pkg.exports)) {
      const exportsMap = pkg.exports as Record<string, unknown>;
      if (isRootImport && isSupportedPackageExportTarget(exportsMap)) {
        return {
          abs: resolvePackageExportTarget(packageRoot, exportsMap),
          unsupportedExports: false,
        };
      }
      const exportKey =
        isRootImport
          ? "."
          : subpath.startsWith("./")
            ? subpath
            : `./${subpath}`;
      if (exportKey in exportsMap) {
        const exportTarget = exportsMap[exportKey];
        if (!isSupportedPackageExportTarget(exportTarget)) {
          return { abs: null, unsupportedExports: true };
        }
        return {
          abs: resolvePackageExportTarget(packageRoot, exportTarget),
          unsupportedExports: false,
        };
      }
      return { abs: null, unsupportedExports: true };
    }
    return { abs: null, unsupportedExports: true };
  }

  if (subpath && subpath !== ".") {
    const candidate = path.join(packageRoot, subpath);
    if (existsFile(candidate)) return { abs: candidate, unsupportedExports: false };
    for (const extension of RESOLUTION_EXTENSIONS) {
      if (existsFile(candidate + extension)) {
        return { abs: candidate + extension, unsupportedExports: false };
      }
    }
    for (const indexName of INDEX_NAMES) {
      const indexPath = path.join(candidate, indexName);
      if (existsFile(indexPath)) {
        return { abs: indexPath, unsupportedExports: false };
      }
    }
    return { abs: null, unsupportedExports: false };
  }

  for (const field of [pkg.module, pkg.main, pkg.types]) {
    if (typeof field === "string") {
      const abs = resolvePackageExportTarget(packageRoot, field);
      if (abs) return { abs, unsupportedExports: false };
    }
  }
  for (const indexName of INDEX_NAMES) {
    const indexPath = path.join(packageRoot, indexName);
    if (existsFile(indexPath)) {
      return { abs: indexPath, unsupportedExports: false };
    }
  }
  return { abs: null, unsupportedExports: false };
}

/** Recover source files when published exports point at omitted build output. */
function resolveWorkspaceSourceEntrypoint(
  packageRoot: string,
  subpath: string
): string | null {
  const sourceSubpath = subpath === "" || subpath === "." ? "index" : subpath;
  const sourceRoot = path.resolve(packageRoot, "src");
  const sourceBase = path.resolve(sourceRoot, sourceSubpath);
  if (sourceBase !== sourceRoot && !sourceBase.startsWith(sourceRoot + path.sep)) {
    return null;
  }
  const candidates = [sourceBase];
  for (const extension of RESOLUTION_EXTENSIONS) candidates.push(sourceBase + extension);
  for (const indexName of INDEX_NAMES) candidates.push(path.join(sourceBase, indexName));
  return candidates.find((candidate) => existsFile(candidate)) ?? null;
}

interface WorkspacePackageResolverInput {
  workspacePath: string;
  packages: WorkspacePackage[];
  isIgnored: (relPath: string) => boolean;
  findIndexedFile: (relPath: string) => string | null;
}

export function createWorkspacePackageResolver({
  workspacePath,
  packages,
  isIgnored,
  findIndexedFile,
}: WorkspacePackageResolverInput): (specifier: string) => ResolveOutcome | null {
  const packageByName = new Map(packages.map((pkg) => [pkg.name, pkg]));

  return (specifier: string): ResolveOutcome | null => {
    const packageName = packageNameFromSpecifier(specifier);
    if (!packageName) return null;
    const workspacePackage = packageByName.get(packageName);
    if (!workspacePackage) return null;

    const remainder =
      specifier === packageName
        ? ""
        : specifier.slice(packageName.length).replace(/^\//, "");
    const packageRoot = path.join(
      workspacePath,
      workspacePackage.rootRel === "." ? "" : workspacePackage.rootRel
    );
    const { abs: packageTarget, unsupportedExports } = resolveViaPackageJson(
      packageRoot,
      remainder || "."
    );
    const abs =
      packageTarget ??
      (unsupportedExports
        ? null
        : resolveWorkspaceSourceEntrypoint(packageRoot, remainder || "."));
    if (unsupportedExports && !abs) {
      return { status: "unresolved", reason: "unsupported_package_exports" };
    }
    if (!abs) return { status: "unresolved", reason: "module_not_found" };
    const rel = absToWorkspaceRel(workspacePath, abs);
    if (!rel) return { status: "unresolved", reason: "outside_workspace" };
    if (isIgnored(rel)) return { status: "ignored", reason: "ignored_path" };
    return {
      status: "resolved_internal",
      relPath: findIndexedFile(rel) ?? rel,
    };
  };
}
