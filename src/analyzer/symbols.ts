import fs from "fs";
import path from "path";
import type { CodeSymbol } from "@/types/report";
import { shouldIndexFileContent } from "./ignoreRules";

const EXPORT_FN = /export\s+(?:async\s+)?function\s+(\w+)/g;
const EXPORT_CONST = /export\s+(?:const|function)\s+(\w+)/g;
const REACT_COMP = /export\s+(?:default\s+)?function\s+([A-Z]\w+)/g;
const PY_DEF = /^def\s+(\w+)\s*\(/gm;
const PY_CLASS = /^class\s+(\w+)/gm;
const JAVA_CLASS = /public\s+class\s+(\w+)/g;

export function extractSymbols(workspacePath: string, filePaths: string[]): CodeSymbol[] {
  const symbols: CodeSymbol[] = [];
  for (const rel of filePaths) {
    if (!shouldIndexFileContent(rel)) continue;
    const ext = path.extname(rel).toLowerCase();
    const full = path.join(workspacePath, rel);
    if (!fs.existsSync(full)) continue;
    let content: string;
    try {
      content = fs.readFileSync(full, "utf-8").slice(0, 50_000);
    } catch {
      continue;
    }
  if ([".ts", ".tsx", ".js", ".jsx"].includes(ext)) {
      for (const re of [EXPORT_FN, EXPORT_CONST, REACT_COMP]) {
        let m;
        re.lastIndex = 0;
        while ((m = re.exec(content)) !== null) {
          symbols.push({
            name: m[1],
            kind: /^[A-Z]/.test(m[1]) ? "component" : "function",
            path: rel,
          });
        }
      }
      if (rel.includes("/api/") && rel.includes("route.")) {
        symbols.push({ name: path.basename(rel, ext), kind: "route", path: rel });
      }
    } else if (ext === ".py") {
      let m;
      while ((m = PY_DEF.exec(content)) !== null) {
        symbols.push({ name: m[1], kind: "function", path: rel });
      }
      while ((m = PY_CLASS.exec(content)) !== null) {
        symbols.push({ name: m[1], kind: "class", path: rel });
      }
    } else if (ext === ".java") {
      let m;
      while ((m = JAVA_CLASS.exec(content)) !== null) {
        symbols.push({ name: m[1], kind: "class", path: rel });
      }
    }
  }
  const seen = new Set<string>();
  return symbols.filter((s) => {
    const key = `${s.path}:${s.name}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 50);
}
