import fs from "fs";
import path from "path";
import ts from "typescript";
import type { CodeSymbol } from "@/types/report";
import { shouldIndexFileContent } from "./ignoreRules";
import { stripJavaCommentsAndLiterals } from "./packs/javaShared";
import { stripPythonCommentsAndStrings } from "./packs/python/signals";
import { scriptKindForPath } from "./packs/tsjsExtract";

const PY_DEF = /^def\s+(\w+)\s*\(/gm;
const PY_CLASS = /^class\s+(\w+)/gm;
const JAVA_CLASS = /public\s+class\s+(\w+)/g;

interface ParserSourceFile extends ts.SourceFile {
  readonly parseDiagnostics: readonly ts.Diagnostic[];
}

function hasModifier(node: ts.Node, kind: ts.SyntaxKind): boolean {
  return ts.canHaveModifiers(node)
    ? Boolean(ts.getModifiers(node)?.some((modifier) => modifier.kind === kind))
    : false;
}

function pushTypeScriptSymbols(
  symbols: CodeSymbol[],
  content: string,
  rel: string
): void {
  const sourceFile = ts.createSourceFile(
    rel,
    content,
    ts.ScriptTarget.Latest,
    true,
    scriptKindForPath(rel)
  ) as ParserSourceFile;
  if (sourceFile.parseDiagnostics.length > 0) return;

  const exportedFunctions = sourceFile.statements.filter(
    (statement): statement is ts.FunctionDeclaration =>
      ts.isFunctionDeclaration(statement) &&
      hasModifier(statement, ts.SyntaxKind.ExportKeyword) &&
      !hasModifier(statement, ts.SyntaxKind.DefaultKeyword) &&
      !hasModifier(statement, ts.SyntaxKind.DeclareKeyword) &&
      Boolean(statement.name)
  );

  for (const statement of exportedFunctions) {
    const name = statement.name?.text;
    if (!name) continue;
    symbols.push({
      name,
      kind: /^[A-Z]/.test(name) ? "component" : "function",
      path: rel,
    });
  }

  for (const statement of sourceFile.statements) {
    if (
      !ts.isVariableStatement(statement) ||
      !hasModifier(statement, ts.SyntaxKind.ExportKeyword) ||
      hasModifier(statement, ts.SyntaxKind.DefaultKeyword) ||
      hasModifier(statement, ts.SyntaxKind.DeclareKeyword) ||
      !(statement.declarationList.flags & ts.NodeFlags.Const)
    ) {
      continue;
    }
    const declaration = statement.declarationList.declarations[0];
    if (!declaration || !ts.isIdentifier(declaration.name)) continue;
    const name = declaration.name.text;
    symbols.push({
      name,
      kind: /^[A-Z]/.test(name) ? "component" : "function",
      path: rel,
    });
  }

  for (const statement of sourceFile.statements) {
    if (
      !ts.isFunctionDeclaration(statement) ||
      !statement.name ||
      !/^[A-Z]/.test(statement.name.text) ||
      !hasModifier(statement, ts.SyntaxKind.ExportKeyword) ||
      hasModifier(statement, ts.SyntaxKind.DeclareKeyword) ||
      hasModifier(statement, ts.SyntaxKind.AsyncKeyword)
    ) {
      continue;
    }
    symbols.push({
      name: statement.name.text,
      kind: "component",
      path: rel,
    });
  }
}

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
      pushTypeScriptSymbols(symbols, content, rel);
      if (rel.includes("/api/") && path.basename(rel, ext) === "route") {
        symbols.push({ name: path.basename(rel, ext), kind: "route", path: rel });
      }
    } else if (ext === ".py") {
      const code = stripPythonCommentsAndStrings(content);
      let m;
      PY_DEF.lastIndex = 0;
      while ((m = PY_DEF.exec(code)) !== null) {
        symbols.push({ name: m[1], kind: "function", path: rel });
      }
      PY_CLASS.lastIndex = 0;
      while ((m = PY_CLASS.exec(code)) !== null) {
        symbols.push({ name: m[1], kind: "class", path: rel });
      }
    } else if (ext === ".java") {
      const code = stripJavaCommentsAndLiterals(content);
      let m;
      JAVA_CLASS.lastIndex = 0;
      while ((m = JAVA_CLASS.exec(code)) !== null) {
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
