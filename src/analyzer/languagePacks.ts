import path from "path";
import type { Report } from "@/types/report";
import type { IndexingPipelineResult } from "./pipeline";
import { runTsJsPack, type TsJsPackResult } from "./packs/tsjs";
import { runPythonPack, type PythonPackResult } from "./packs/python";
import { runJavaPack, type JavaPackResult } from "./packs/java";

const TSJS_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"]);
const PYTHON_EXTENSIONS = new Set([".py"]);
const JAVA_EXTENSIONS = new Set([".java"]);

export interface PackResults {
  tsjs: TsJsPackResult | null;
  python: PythonPackResult | null;
  java: JavaPackResult | null;
  hasTsJsFiles: boolean;
  hasPythonFiles: boolean;
  hasJavaFiles: boolean;
}

export function collectLanguageWarnings(packs: PackResults): string[] {
  const warnings: string[] = [
    ...(packs.tsjs?.warnings ?? []),
    ...(packs.python?.warnings ?? []),
    ...(packs.java?.warnings ?? []),
  ];
  if (!packs.hasTsJsFiles && !packs.hasPythonFiles && !packs.hasJavaFiles) {
    warnings.push("Deep analysis unavailable: no supported source files detected.");
  }
  return warnings;
}

export function runLanguagePacks(
  workspacePath: string,
  pipeline: IndexingPipelineResult,
  filePaths: string[]
): PackResults {
  const hasTsJsFiles = filePaths.some((filePath) =>
    TSJS_EXTENSIONS.has(path.extname(filePath))
  );
  const hasPythonFiles = filePaths.some((filePath) =>
    PYTHON_EXTENSIONS.has(path.extname(filePath))
  );
  const hasJavaFiles = filePaths.some((filePath) =>
    JAVA_EXTENSIONS.has(path.extname(filePath))
  );

  return {
    hasTsJsFiles,
    hasPythonFiles,
    hasJavaFiles,
    tsjs: hasTsJsFiles ? runTsJsPack(workspacePath, pipeline) : null,
    python: hasPythonFiles ? runPythonPack(workspacePath, pipeline) : null,
    java: hasJavaFiles ? runJavaPack(workspacePath, pipeline) : null,
  };
}

export function combineArchitecture(packs: PackResults): Report["architecture"] {
  const nodes: Report["architecture"]["nodes"] = [];
  const edges: Report["architecture"]["edges"] = [];
  const seenNodeIds = new Set<string>();

  const addPack = (prefix: string, architecture?: Report["architecture"] | null): void => {
    if (!architecture) return;
    for (const node of architecture.nodes) {
      const id = `${prefix}:${node.id}`;
      if (seenNodeIds.has(id)) continue;
      seenNodeIds.add(id);
      nodes.push({ ...node, id });
    }
    for (const edge of architecture.edges) {
      edges.push({
        ...edge,
        from: `${prefix}:${edge.from}`,
        to: `${prefix}:${edge.to}`,
      });
    }
  };

  addPack("tsjs", packs.tsjs?.architecture);
  addPack("python", packs.python?.architecture);
  addPack("java", packs.java?.architecture);

  return { nodes, edges };
}
