/**
 * TS/JS language pack: import extraction, entrypoints, test proximity, complexity proxy.
 */

import fs from "fs";
import path from "path";
import type { Architecture } from "@/types/report";
import type { IndexingPipelineResult } from "../pipeline";

const IMPORT_RE =
  /(?:import\s+.*\s+from\s+['"]([^'"]+)['"]|require\s*\(\s*['"]([^'"]+)['"]\s*\)|import\s+['"]([^'"]+)['"])/g;

const TEST_PATTERNS = [
  /\.(test|spec)\.(ts|tsx|js|jsx|mjs|cjs)$/i,
  /__tests__\//,
];

const ENTRY_INDEX = /index\.(ts|tsx|js|jsx|mjs|cjs)$/i;
const COMPLEXITY_RE =
  /\b(if|else|for|while|switch|catch|\?\s*:|\|\||&&)\b/g;

export interface TsJsPackResult {
  architecture: Architecture;
  imports: Map<string, Set<string>>;
  fanIn: Map<string, number>;
  fanOut: Map<string, number>;
  entrypoints: Set<string>;
  testFiles: Set<string>;
  complexity: Map<string, number>;
}

function resolveImport(
  fromFile: string,
  importPath: string,
  workspacePath: string
): string | null {
  if (importPath.startsWith(".")) {
    const fromDir = path.dirname(fromFile);
    let resolved = path.normalize(path.join(fromDir, importPath));
    const ext = path.extname(resolved);
    if (!ext) {
      const candidates = [".ts", ".tsx", ".js", ".jsx", "/index.ts", "/index.js"];
      for (const c of candidates) {
        const p = path.join(workspacePath, resolved + c);
        if (fs.existsSync(p)) return path.normalize(resolved + c);
      }
      return path.normalize(resolved + ".ts"); // guess
    }
    return path.normalize(resolved);
  }
  return null; // skip node_modules
}

export function runTsJsPack(
  workspacePath: string,
  pipeline: IndexingPipelineResult
): TsJsPackResult {
  const imports = new Map<string, Set<string>>();
  const fanIn = new Map<string, number>();
  const fanOut = new Map<string, number>();
  const entrypoints = new Set<string>();
  const testFiles = new Set<string>();
  const complexity = new Map<string, number>();

  const codeExts = [".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"];
  const files = Array.from(pipeline.file_metadata.keys()).filter((f) =>
    codeExts.includes(path.extname(f))
  );

  for (const f of files) {
    if (TEST_PATTERNS.some((p) => p.test(f))) testFiles.add(f);
    if (ENTRY_INDEX.test(f)) entrypoints.add(f);

    const fullPath = path.join(workspacePath, f);
    let content: string;
    try {
      content = fs.readFileSync(fullPath, "utf-8");
    } catch {
      continue;
    }

    const mc = content.match(COMPLEXITY_RE);
    complexity.set(f, mc ? mc.length : 0);

    const targets = new Set<string>();
    let m: RegExpExecArray | null;
    IMPORT_RE.lastIndex = 0;
    while ((m = IMPORT_RE.exec(content))) {
      const imp = (m[1] ?? m[2] ?? m[3])!;
      const resolved = resolveImport(f, imp, workspacePath);
      if (resolved && pipeline.file_metadata.has(resolved)) {
        targets.add(resolved);
      }
    }
    imports.set(f, targets);
    fanOut.set(f, targets.size);
    for (const t of targets) {
      fanIn.set(t, (fanIn.get(t) ?? 0) + 1);
    }
  }

  const nodes = files.map((id) => ({
    id,
    label: path.basename(id),
    type: "file" as const,
  }));
  const edges: { from: string; to: string; type: "import" }[] = [];
  for (const [from, tos] of imports) {
    for (const to of tos) {
      edges.push({ from, to, type: "import" });
    }
  }

  const architecture: Architecture = { nodes, edges };

  return {
    architecture,
    imports,
    fanIn,
    fanOut,
    entrypoints,
    testFiles,
    complexity,
  };
}
