import path from "path";
import type { IndexingPipelineResult } from "../pipeline";
import { shouldSkipPath } from "../ignoreRules";
import type { JavaSourceIndex } from "./javaSources";
import {
  JAVA_EXTENSION,
  packageNameFromSource,
  readJavaSource,
} from "./javaShared";

const IMPORT_RE = /^\s*import\s+(static\s+)?([\w.]+(?:\.\*)?)\s*;/gm;

export interface JavaSemanticGraph {
  imports: Map<string, Set<string>>;
  fanIn: Map<string, number>;
  fanOut: Map<string, number>;
}

export function extractImportSpecifiers(content: string): string[] {
  const specs: string[] = [];
  const seen = new Set<string>();
  IMPORT_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = IMPORT_RE.exec(content))) {
    const isStatic = Boolean(match[1]);
    let spec = match[2].trim();
    if (isStatic && spec.endsWith(".*")) spec = spec.slice(0, -2);
    if (spec && !seen.has(spec)) {
      seen.add(spec);
      specs.push(spec);
    }
  }
  return specs;
}

function resolveImport(
  importSpec: string,
  sourceIndex: JavaSourceIndex
): string[] {
  if (importSpec.endsWith(".*")) {
    return sourceIndex.packageToFiles.get(importSpec.slice(0, -2)) ?? [];
  }
  let cursor = importSpec;
  while (cursor) {
    const resolved = sourceIndex.fqnToFile.get(cursor);
    if (resolved) return [resolved];
    const split = cursor.lastIndexOf(".");
    if (split <= 0) break;
    cursor = cursor.slice(0, split);
  }
  return [];
}

export function collectSamePackageRefs(
  content: string,
  selfPath: string,
  siblings: string[]
): string[] {
  const body = content
    .split("\n")
    .filter((line) => !/^\s*(?:package|import)\s+/.test(line))
    .join("\n")
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/\/\/[^\n]*/g, " ")
    .replace(/"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'/g, " ");
  const refs: string[] = [];
  for (const sibling of siblings) {
    if (sibling === selfPath) continue;
    const typeName = path.basename(sibling, JAVA_EXTENSION);
    if (!/^[A-Za-z_][\w]*$/.test(typeName)) continue;
    if (new RegExp(`\\b${typeName}\\b`).test(body)) refs.push(sibling);
  }
  return refs;
}

export function buildJavaSemanticGraph(
  files: string[],
  workspacePath: string,
  pipeline: IndexingPipelineResult,
  sourceIndex: JavaSourceIndex
): JavaSemanticGraph {
  const imports = new Map<string, Set<string>>();
  const fanIn = new Map<string, number>();
  const fanOut = new Map<string, number>();

  for (const filePath of files) {
    const content = readJavaSource(workspacePath, filePath);
    const targets = new Set<string>();
    if (content !== null) {
      for (const spec of extractImportSpecifiers(content)) {
        for (const target of resolveImport(spec, sourceIndex)) {
          if (
            pipeline.file_metadata.has(target) &&
            !shouldSkipPath(target) &&
            target !== filePath
          ) {
            targets.add(target);
          }
        }
      }
      const packageName = packageNameFromSource(content);
      const siblings = sourceIndex.packageToFiles.get(packageName) ?? [];
      for (const sibling of collectSamePackageRefs(content, filePath, siblings)) {
        if (pipeline.file_metadata.has(sibling) && !shouldSkipPath(sibling)) {
          targets.add(sibling);
        }
      }
    }
    imports.set(filePath, targets);
    fanOut.set(filePath, targets.size);
    for (const target of targets) {
      fanIn.set(target, (fanIn.get(target) ?? 0) + 1);
    }
  }

  for (const filePath of files) {
    if (!fanIn.has(filePath)) fanIn.set(filePath, 0);
  }
  return { imports, fanIn, fanOut };
}
