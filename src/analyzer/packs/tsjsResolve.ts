/**
 * TypeScript module resolution + workspace package discovery for RepoAtlas.
 * Never traverses outside the extracted workspace root.
 */

import fs from "fs";
import path from "path";
import ts from "typescript";
import { normalizeRelPath } from "../semanticGraph";

const RESOLUTION_EXTENSIONS = [".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".d.ts"];
const INDEX_NAMES = [
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

export interface TsJsResolver {
  resolve(fromRelFile: string, specifier: string): ResolveOutcome;
  workspacePackages: WorkspacePackage[];
  warnings: string[];
}

function existsFile(abs: string): boolean {
  try {
    return fs.existsSync(abs) && fs.statSync(abs).isFile();
  } catch {
    return false;
  }
}

function existsDir(abs: string): boolean {
  try {
    return fs.existsSync(abs) && fs.statSync(abs).isDirectory();
  } catch {
    return false;
  }
}

function readJson(abs: string): unknown | null {
  try {
    return JSON.parse(fs.readFileSync(abs, "utf-8"));
  } catch {
    return null;
  }
}

function packageNameFromSpecifier(specifier: string): string | null {
  if (specifier.startsWith(".") || specifier.startsWith("/")) return null;
  if (specifier.startsWith("@")) {
    const parts = specifier.split("/");
    if (parts.length < 2) return null;
    return `${parts[0]}/${parts[1]}`;
  }
  return specifier.split("/")[0] || null;
}

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
    .filter((d) => d.isDirectory())
    .map((d) => normalizeRelPath(path.join(prefix, d.name + suffix.replace(/^\//, ""))))
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
      const raw = fs.readFileSync(pnpmPath, "utf-8");
      // Minimal YAML list parse for `packages:` entries; no full YAML engine.
      const lines = raw.split(/\r?\n/);
      let inPackages = false;
      for (const line of lines) {
        if (/^packages\s*:/.test(line)) {
          inPackages = true;
          continue;
        }
        if (inPackages) {
          if (/^\S/.test(line) && !/^\s*-/.test(line)) break;
          const m = line.match(/^\s*-\s*['"]?([^'"]+)['"]?\s*$/);
          if (m) patterns.push(m[1]);
        }
      }
    } catch {
      // ignore
    }
  }

  return patterns;
}

export function discoverWorkspacePackages(workspacePath: string): WorkspacePackage[] {
  const roots = new Set<string>();
  roots.add(".");
  for (const pattern of readWorkspacePatterns(workspacePath)) {
    for (const root of expandWorkspaceGlob(workspacePath, pattern)) {
      roots.add(root === "" ? "." : root);
    }
  }

  const packages: WorkspacePackage[] = [];
  for (const rootRel of Array.from(roots).sort((a, b) => a.localeCompare(b))) {
    const pkgRel = rootRel === "." ? "package.json" : `${rootRel}/package.json`;
    const abs = path.join(workspacePath, pkgRel);
    if (!existsFile(abs)) continue;
    const pkg = readJson(abs) as { name?: string } | null;
    if (!pkg?.name || typeof pkg.name !== "string") continue;
    packages.push({
      name: pkg.name,
      rootRel: rootRel === "." ? "." : normalizeRelPath(rootRel),
      packageJsonRel: normalizeRelPath(pkgRel),
    });
  }
  return packages;
}

function resolvePackageExportTarget(
  pkgRootAbs: string,
  target: unknown
): string | null {
  if (typeof target === "string") {
    const abs = path.normalize(path.join(pkgRootAbs, target));
    if (!abs.startsWith(path.normalize(pkgRootAbs + path.sep)) && abs !== path.normalize(pkgRootAbs)) {
      return null;
    }
    if (existsFile(abs)) return abs;
    for (const ext of RESOLUTION_EXTENSIONS) {
      if (existsFile(abs + ext)) return abs + ext;
    }
    for (const indexName of INDEX_NAMES) {
      const idx = path.join(abs, indexName);
      if (existsFile(idx)) return idx;
    }
    return existsFile(abs) ? abs : null;
  }
  if (target && typeof target === "object" && !Array.isArray(target)) {
    const record = target as Record<string, unknown>;
    for (const key of ["import", "require", "default", "module", "browser", "types"]) {
      if (key in record) {
        const resolved = resolvePackageExportTarget(pkgRootAbs, record[key]);
        if (resolved) return resolved;
      }
    }
  }
  return null;
}

function resolveViaPackageJson(
  pkgRootAbs: string,
  subpath: string
): { abs: string | null; unsupportedExports: boolean } {
  const pkg = readJson(path.join(pkgRootAbs, "package.json")) as {
    main?: string;
    module?: string;
    types?: string;
    exports?: unknown;
  } | null;
  if (!pkg) return { abs: null, unsupportedExports: false };

  if (pkg.exports != null) {
    if (typeof pkg.exports === "string" && (subpath === "" || subpath === ".")) {
      return {
        abs: resolvePackageExportTarget(pkgRootAbs, pkg.exports),
        unsupportedExports: false,
      };
    }
    if (pkg.exports && typeof pkg.exports === "object" && !Array.isArray(pkg.exports)) {
      const exportsMap = pkg.exports as Record<string, unknown>;
      const exportKey =
        subpath === "" || subpath === "."
          ? "."
          : subpath.startsWith("./")
            ? subpath
            : `./${subpath}`;
      if (exportKey in exportsMap) {
        return {
          abs: resolvePackageExportTarget(pkgRootAbs, exportsMap[exportKey]),
          unsupportedExports: false,
        };
      }
      // Pattern exports / conditions we cannot deterministically expand.
      const hasPatterns = Object.keys(exportsMap).some((k) => k.includes("*"));
      if (hasPatterns) return { abs: null, unsupportedExports: true };
      return { abs: null, unsupportedExports: true };
    }
  }

  if (subpath && subpath !== ".") {
    const candidate = path.join(pkgRootAbs, subpath);
    if (existsFile(candidate)) return { abs: candidate, unsupportedExports: false };
    for (const ext of RESOLUTION_EXTENSIONS) {
      if (existsFile(candidate + ext)) {
        return { abs: candidate + ext, unsupportedExports: false };
      }
    }
    for (const indexName of INDEX_NAMES) {
      const idx = path.join(candidate, indexName);
      if (existsFile(idx)) return { abs: idx, unsupportedExports: false };
    }
    return { abs: null, unsupportedExports: false };
  }

  for (const field of [pkg.module, pkg.main, pkg.types]) {
    if (typeof field === "string") {
      const abs = resolvePackageExportTarget(pkgRootAbs, field);
      if (abs) return { abs, unsupportedExports: false };
    }
  }

  for (const indexName of INDEX_NAMES) {
    const idx = path.join(pkgRootAbs, indexName);
    if (existsFile(idx)) return { abs: idx, unsupportedExports: false };
  }
  return { abs: null, unsupportedExports: false };
}

function loadCompilerOptions(workspacePath: string): {
  options: ts.CompilerOptions;
  configDir: string;
  warnings: string[];
} {
  const warnings: string[] = [];
  const configName =
    ts.findConfigFile(workspacePath, ts.sys.fileExists, "tsconfig.json") ??
    ts.findConfigFile(workspacePath, ts.sys.fileExists, "jsconfig.json");

  if (!configName) {
    return {
      options: {
        module: ts.ModuleKind.ESNext,
        moduleResolution: ts.ModuleResolutionKind.Bundler,
        target: ts.ScriptTarget.ESNext,
        jsx: ts.JsxEmit.ReactJSX,
        allowJs: true,
        baseUrl: workspacePath,
      },
      configDir: workspacePath,
      warnings,
    };
  }

  const configFile = ts.readConfigFile(configName, ts.sys.readFile);
  if (configFile.error) {
    warnings.push("Could not parse tsconfig/jsconfig; using default module resolution.");
    return {
      options: {
        module: ts.ModuleKind.ESNext,
        moduleResolution: ts.ModuleResolutionKind.Bundler,
        allowJs: true,
        baseUrl: workspacePath,
      },
      configDir: path.dirname(configName),
      warnings,
    };
  }

  const parsed = ts.parseJsonConfigFileContent(
    configFile.config,
    ts.sys,
    path.dirname(configName)
  );
  if (parsed.errors.length > 0) {
    warnings.push("tsconfig/jsconfig reported parse issues; resolution may be degraded.");
  }
  return {
    options: {
      ...parsed.options,
      allowJs: parsed.options.allowJs ?? true,
      moduleResolution:
        parsed.options.moduleResolution ?? ts.ModuleResolutionKind.Bundler,
    },
    configDir: path.dirname(configName),
    warnings,
  };
}

function absToWorkspaceRel(
  workspacePath: string,
  absPath: string
): string | null {
  const root = path.resolve(workspacePath);
  const abs = path.resolve(absPath);
  const rel = path.relative(root, abs);
  if (rel.startsWith("..") || path.isAbsolute(rel)) return null;
  return normalizeRelPath(rel);
}

export function createTsJsResolver(
  workspacePath: string,
  fileIndex: Set<string>,
  isIgnored: (relPath: string) => boolean
): TsJsResolver {
  const warnings: string[] = [];
  const workspacePackages = discoverWorkspacePackages(workspacePath);
  const packageByName = new Map(workspacePackages.map((p) => [p.name, p]));
  const { options, warnings: configWarnings } = loadCompilerOptions(workspacePath);
  warnings.push(...configWarnings);

  const host: ts.ModuleResolutionHost = {
    fileExists: ts.sys.fileExists,
    readFile: ts.sys.readFile,
    directoryExists: ts.sys.directoryExists,
    getCurrentDirectory: () => workspacePath,
    getDirectories: ts.sys.getDirectories,
    realpath: ts.sys.realpath,
  };

  const tryIndexLookup = (relPath: string): string | null => {
    const normalized = normalizeRelPath(relPath);
    if (fileIndex.has(normalized) && !isIgnored(normalized)) return normalized;
    // Match platform-specific keys that may exist in the pipeline map.
    for (const candidate of fileIndex) {
      if (normalizeRelPath(candidate) === normalized && !isIgnored(candidate)) {
        return candidate;
      }
    }
    return null;
  };

  const resolveRelativeOrAliased = (
    fromRelFile: string,
    specifier: string
  ): ResolveOutcome => {
    const containingFile = path.join(workspacePath, fromRelFile);
    const resolved = ts.resolveModuleName(specifier, containingFile, options, host);
    const resolvedName = resolved.resolvedModule?.resolvedFileName;
    if (!resolvedName) {
      // Manual relative fallback for extensionless paths.
      if (specifier.startsWith("./") || specifier.startsWith("../")) {
        const fromDir = path.dirname(fromRelFile);
        const base = path.normalize(path.join(fromDir, specifier));
        const candidates: string[] = [];
        if (path.extname(base)) candidates.push(base);
        else {
          for (const ext of RESOLUTION_EXTENSIONS) candidates.push(base + ext);
          for (const indexName of INDEX_NAMES) {
            candidates.push(path.join(base, indexName));
          }
        }
        for (const candidate of candidates) {
          const rel = normalizeRelPath(candidate);
          const hit = tryIndexLookup(rel);
          if (hit) return { status: "resolved_internal", relPath: hit };
          if (existsFile(path.join(workspacePath, rel))) {
            if (isIgnored(rel)) return { status: "ignored", reason: "ignored_path" };
            return { status: "resolved_internal", relPath: rel };
          }
        }
      }
      return { status: "unresolved", reason: "module_not_found" };
    }

    const rel = absToWorkspaceRel(workspacePath, resolvedName);
    if (!rel) {
      // Resolved outside workspace (node_modules etc.) — treat as external.
      const pkgName = packageNameFromSpecifier(specifier);
      if (pkgName) return { status: "resolved_external", packageName: pkgName };
      return { status: "unresolved", reason: "outside_workspace" };
    }

    if (isIgnored(rel)) return { status: "ignored", reason: "ignored_path" };

    // Prefer files present in the indexed workspace snapshot.
    const indexed = tryIndexLookup(rel);
    if (indexed) return { status: "resolved_internal", relPath: indexed };

    // .d.ts may resolve but not be a runtime entry; still record as internal when on disk.
    if (existsFile(path.join(workspacePath, rel))) {
      return { status: "resolved_internal", relPath: rel };
    }
    return { status: "unresolved", reason: "module_not_found" };
  };

  const resolveWorkspacePackage = (specifier: string): ResolveOutcome | null => {
    const pkgName = packageNameFromSpecifier(specifier);
    if (!pkgName) return null;
    const ws = packageByName.get(pkgName);
    if (!ws) return null;

    const remainder =
      specifier === pkgName
        ? ""
        : specifier.slice(pkgName.length).replace(/^\//, "");
    const pkgRootAbs = path.join(workspacePath, ws.rootRel === "." ? "" : ws.rootRel);
    const { abs, unsupportedExports } = resolveViaPackageJson(
      pkgRootAbs,
      remainder || "."
    );
    if (unsupportedExports && !abs) {
      return { status: "unresolved", reason: "unsupported_package_exports" };
    }
    if (!abs) return { status: "unresolved", reason: "module_not_found" };
    const rel = absToWorkspaceRel(workspacePath, abs);
    if (!rel) return { status: "unresolved", reason: "outside_workspace" };
    if (isIgnored(rel)) return { status: "ignored", reason: "ignored_path" };
    const indexed = tryIndexLookup(rel);
    return { status: "resolved_internal", relPath: indexed ?? rel };
  };

  return {
    workspacePackages,
    warnings,
    resolve(fromRelFile: string, specifier: string): ResolveOutcome {
      if (!specifier) {
        return { status: "unresolved", reason: "non_literal_specifier" };
      }

      const wsHit = resolveWorkspacePackage(specifier);
      if (wsHit) return wsHit;

      if (specifier.startsWith(".") || specifier.startsWith("/")) {
        return resolveRelativeOrAliased(fromRelFile, specifier);
      }

      // Path aliases / baseUrl via TS resolver.
      const aliased = resolveRelativeOrAliased(fromRelFile, specifier);
      if (aliased.status === "resolved_internal" || aliased.status === "ignored") {
        return aliased;
      }

      const pkgName = packageNameFromSpecifier(specifier);
      if (pkgName) {
        return { status: "resolved_external", packageName: pkgName };
      }
      return { status: "unresolved", reason: "module_not_found" };
    },
  };
}
