/** TypeScript compiler options, aliases, and relative module resolution. */

import fs from "fs";
import path from "path";
import ts from "typescript";
import { normalizeRelPath } from "../semanticGraph";
import {
  INDEX_NAMES,
  RESOLUTION_EXTENSIONS,
  absToWorkspaceRel,
  existsFile,
  packageNameFromSpecifier,
  type ResolveOutcome,
} from "./tsjsResolveShared";

interface CompilerResolution {
  options: ts.CompilerOptions;
  warnings: string[];
}

function defaultCompilerOptions(workspacePath: string): ts.CompilerOptions {
  return {
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    target: ts.ScriptTarget.ESNext,
    jsx: ts.JsxEmit.ReactJSX,
    allowJs: true,
    baseUrl: workspacePath,
  };
}

function loadCompilerOptions(workspacePath: string): CompilerResolution {
  const configName =
    ts.findConfigFile(workspacePath, ts.sys.fileExists, "tsconfig.json") ??
    ts.findConfigFile(workspacePath, ts.sys.fileExists, "jsconfig.json");
  if (!configName) return { options: defaultCompilerOptions(workspacePath), warnings: [] };

  const configFile = ts.readConfigFile(configName, ts.sys.readFile);
  if (configFile.error) {
    return {
      options: {
        module: ts.ModuleKind.ESNext,
        moduleResolution: ts.ModuleResolutionKind.Bundler,
        allowJs: true,
        baseUrl: workspacePath,
      },
      warnings: ["Could not parse tsconfig/jsconfig; using default module resolution."],
    };
  }

  const parsed = ts.parseJsonConfigFileContent(
    configFile.config,
    ts.sys,
    path.dirname(configName)
  );
  return {
    options: {
      ...parsed.options,
      allowJs: parsed.options.allowJs ?? true,
      moduleResolution:
        parsed.options.moduleResolution ?? ts.ModuleResolutionKind.Bundler,
    },
    warnings:
      parsed.errors.length > 0
        ? ["tsconfig/jsconfig reported parse issues; resolution may be degraded."]
        : [],
  };
}

interface CompilerResolverInput {
  workspacePath: string;
  isIgnored: (relPath: string) => boolean;
  findIndexedFile: (relPath: string) => string | null;
}

export function createCompilerResolver({
  workspacePath,
  isIgnored,
  findIndexedFile,
}: CompilerResolverInput): {
  warnings: string[];
  resolve(fromRelFile: string, specifier: string): ResolveOutcome;
} {
  const { options, warnings } = loadCompilerOptions(workspacePath);
  const host: ts.ModuleResolutionHost = {
    fileExists: ts.sys.fileExists,
    readFile: ts.sys.readFile,
    directoryExists: ts.sys.directoryExists,
    getCurrentDirectory: () => workspacePath,
    getDirectories: ts.sys.getDirectories,
    realpath: ts.sys.realpath,
  };

  return {
    warnings,
    resolve(fromRelFile: string, specifier: string): ResolveOutcome {
      const containingFile = path.join(workspacePath, fromRelFile);
      const resolved = ts.resolveModuleName(specifier, containingFile, options, host);
      const resolvedName = resolved.resolvedModule?.resolvedFileName;
      if (!resolvedName) {
        if (specifier.startsWith("./") || specifier.startsWith("../")) {
          const base = path.normalize(path.join(path.dirname(fromRelFile), specifier));
          const candidates: string[] = [];
          if (path.extname(base)) candidates.push(base);
          else {
            for (const extension of RESOLUTION_EXTENSIONS) candidates.push(base + extension);
            for (const indexName of INDEX_NAMES) candidates.push(path.join(base, indexName));
          }
          for (const candidate of candidates) {
            const rel = normalizeRelPath(candidate);
            const indexed = findIndexedFile(rel);
            if (indexed) return { status: "resolved_internal", relPath: indexed };
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
        const packageName = packageNameFromSpecifier(specifier);
        return packageName
          ? { status: "resolved_external", packageName }
          : { status: "unresolved", reason: "outside_workspace" };
      }
      const normalizedRel = normalizeRelPath(rel);
      if (
        normalizedRel === "node_modules" ||
        normalizedRel.startsWith("node_modules/") ||
        normalizedRel.includes("/node_modules/")
      ) {
        const packageName = packageNameFromSpecifier(specifier);
        return packageName
          ? { status: "resolved_external", packageName }
          : { status: "unresolved", reason: "outside_workspace" };
      }
      if (isIgnored(rel)) return { status: "ignored", reason: "ignored_path" };
      const indexed = findIndexedFile(rel);
      if (indexed) return { status: "resolved_internal", relPath: indexed };
      if (existsFile(path.join(workspacePath, rel))) {
        return { status: "resolved_internal", relPath: rel };
      }
      return { status: "unresolved", reason: "module_not_found" };
    },
  };
}
