/**
 * TypeScript Compiler API extraction of import/export edges.
 * Ignores comments and string contents; only structured syntax nodes count.
 */

import ts from "typescript";
import type { SemanticEdgeKind } from "@/types/semanticGraph";
import { boundSnippet, normalizeRelPath } from "../semanticGraph";

export interface ExtractedModuleRef {
  specifier: string | null;
  kind: SemanticEdgeKind;
  typeOnly: boolean;
  lineStart: number;
  lineEnd: number;
  snippet: string;
  reason?: string;
}

function lineOf(sourceFile: ts.SourceFile, pos: number): number {
  return sourceFile.getLineAndCharacterOfPosition(pos).line + 1;
}

function snippetFor(sourceFile: ts.SourceFile, node: ts.Node): string {
  const text = sourceFile.text.slice(node.getStart(sourceFile), node.getEnd());
  return boundSnippet(text);
}

function pushLiteral(
  out: ExtractedModuleRef[],
  sourceFile: ts.SourceFile,
  node: ts.Node,
  literal: ts.Expression | undefined,
  kind: SemanticEdgeKind,
  typeOnly: boolean
): void {
  if (!literal) {
    out.push({
      specifier: null,
      kind,
      typeOnly,
      lineStart: lineOf(sourceFile, node.getStart(sourceFile)),
      lineEnd: lineOf(sourceFile, node.getEnd()),
      snippet: snippetFor(sourceFile, node),
      reason: "non_literal_specifier",
    });
    return;
  }

  if (ts.isStringLiteral(literal) || ts.isNoSubstitutionTemplateLiteral(literal)) {
    out.push({
      specifier: literal.text,
      kind,
      typeOnly,
      lineStart: lineOf(sourceFile, node.getStart(sourceFile)),
      lineEnd: lineOf(sourceFile, node.getEnd()),
      snippet: snippetFor(sourceFile, node),
    });
    return;
  }

  out.push({
    specifier: null,
    kind,
    typeOnly,
    lineStart: lineOf(sourceFile, node.getStart(sourceFile)),
    lineEnd: lineOf(sourceFile, node.getEnd()),
    snippet: snippetFor(sourceFile, node),
    reason: "non_literal_specifier",
  });
}

function isRequireCallee(expr: ts.Expression): boolean {
  return ts.isIdentifier(expr) && expr.text === "require";
}

/**
 * Walk a source file AST and collect module references.
 * Does not execute code; commentary and plain strings never produce edges.
 */
export function extractModuleRefsFromSource(
  fileName: string,
  content: string,
  scriptKind: ts.ScriptKind
): { refs: ExtractedModuleRef[]; parseFailed: boolean } {
  const sourceFile = ts.createSourceFile(
    fileName,
    content,
    ts.ScriptTarget.Latest,
    true,
    scriptKind
  );

  // createSourceFile always returns a tree; parse diagnostics are attached when
  // using the language service. For malformed files we still walk what we can.
  const refs: ExtractedModuleRef[] = [];

  const visit = (node: ts.Node): void => {
    if (ts.isImportDeclaration(node)) {
      const typeOnly = Boolean(node.importClause?.isTypeOnly);
      pushLiteral(
        refs,
        sourceFile,
        node,
        node.moduleSpecifier,
        "import",
        typeOnly
      );
      return;
    }

    if (ts.isExportDeclaration(node) && node.moduleSpecifier) {
      const typeOnly = Boolean(node.isTypeOnly);
      pushLiteral(
        refs,
        sourceFile,
        node,
        node.moduleSpecifier,
        "re_export",
        typeOnly
      );
      return;
    }

    if (ts.isImportEqualsDeclaration(node) && ts.isExternalModuleReference(node.moduleReference)) {
      pushLiteral(
        refs,
        sourceFile,
        node,
        node.moduleReference.expression,
        "require",
        Boolean(node.isTypeOnly)
      );
      return;
    }

    if (ts.isCallExpression(node)) {
      const expr = node.expression;
      if (expr.kind === ts.SyntaxKind.ImportKeyword) {
        pushLiteral(
          refs,
          sourceFile,
          node,
          node.arguments[0],
          "dynamic_import",
          false
        );
        return;
      }
      if (isRequireCallee(expr)) {
        pushLiteral(
          refs,
          sourceFile,
          node,
          node.arguments[0],
          "require",
          false
        );
        return;
      }
    }

    ts.forEachChild(node, visit);
  };

  visit(sourceFile);
  return { refs, parseFailed: false };
}

export function scriptKindForPath(relPath: string): ts.ScriptKind {
  const n = normalizeRelPath(relPath).toLowerCase();
  if (n.endsWith(".tsx")) return ts.ScriptKind.TSX;
  if (n.endsWith(".jsx")) return ts.ScriptKind.JSX;
  if (n.endsWith(".js") || n.endsWith(".mjs") || n.endsWith(".cjs")) {
    return ts.ScriptKind.JS;
  }
  return ts.ScriptKind.TS;
}

/** Structural complexity from AST decision points + nesting depth + LOC. */
export function computeAstComplexity(content: string, fileName: string, scriptKind: ts.ScriptKind): {
  loc: number;
  branchCount: number;
  maxNesting: number;
  /** Documented structural complexity: branches*3 + nesting*2 + loc/40. */
  score: number;
} {
  const sourceFile = ts.createSourceFile(
    fileName,
    content,
    ts.ScriptTarget.Latest,
    true,
    scriptKind
  );

  const loc = content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(
      (line) =>
        line.length > 0 &&
        !line.startsWith("//") &&
        !line.startsWith("/*") &&
        !line.startsWith("*") &&
        !line.startsWith("*/")
    ).length;

  let branchCount = 0;
  let maxNesting = 0;

  const visit = (node: ts.Node, depth: number): void => {
    maxNesting = Math.max(maxNesting, depth);

    switch (node.kind) {
      case ts.SyntaxKind.IfStatement:
      case ts.SyntaxKind.ForStatement:
      case ts.SyntaxKind.ForInStatement:
      case ts.SyntaxKind.ForOfStatement:
      case ts.SyntaxKind.WhileStatement:
      case ts.SyntaxKind.DoStatement:
      case ts.SyntaxKind.CatchClause:
      case ts.SyntaxKind.ConditionalExpression:
      case ts.SyntaxKind.CaseClause:
        branchCount += 1;
        break;
      case ts.SyntaxKind.BinaryExpression: {
        const bin = node as ts.BinaryExpression;
        if (
          bin.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken ||
          bin.operatorToken.kind === ts.SyntaxKind.BarBarToken ||
          bin.operatorToken.kind === ts.SyntaxKind.QuestionQuestionToken
        ) {
          branchCount += 1;
        }
        break;
      }
      default:
        break;
    }

    const nextDepth =
      ts.isBlock(node) ||
      ts.isFunctionLike(node) ||
      ts.isClassLike(node) ||
      ts.isModuleBlock(node)
        ? depth + 1
        : depth;
    ts.forEachChild(node, (child) => visit(child, nextDepth));
  };

  visit(sourceFile, 0);
  const score = branchCount * 3 + maxNesting * 2 + Math.round(loc / 40);
  return { loc, branchCount, maxNesting, score };
}
