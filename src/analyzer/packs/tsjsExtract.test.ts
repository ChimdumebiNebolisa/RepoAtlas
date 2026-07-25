import ts from "typescript";
import { describe, expect, it } from "vitest";
import {
  computeAstComplexity,
  extractModuleRefsFromSource,
  scriptKindForPath,
} from "./tsjsExtract";

const EXTENSIONS = [".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"] as const;

function validSource(extension: (typeof EXTENSIONS)[number]): string {
  if (extension === ".tsx" || extension === ".jsx") {
    return [
      'import { value } from "./target";',
      "export const View = () => <div>{value}</div>;",
    ].join("\n");
  }
  if (extension === ".cjs") {
    return 'const value = require("./target");\nmodule.exports = value;\n';
  }
  return 'import { value } from "./target";\nexport { value };\n';
}

function malformedSource(extension: (typeof EXTENSIONS)[number]): string {
  if (extension === ".tsx" || extension === ".jsx") {
    return [
      'import { value } from "./target";',
      "export const Broken = () => <div>",
    ].join("\n");
  }
  if (extension === ".cjs") {
    return 'const value = require("./target");\nfunction broken( {\n';
  }
  return 'import { value } from "./target";\nfunction broken( {\n';
}

describe("TypeScript and JavaScript extraction evidence", () => {
  it.each(EXTENSIONS)(
    "fails closed on recovered module references in malformed %s files",
    (extension) => {
      const fileName = `src/broken${extension}`;
      const result = extractModuleRefsFromSource(
        fileName,
        malformedSource(extension),
        scriptKindForPath(fileName)
      );

      expect(result).toEqual({ refs: [], parseFailed: true });
    }
  );

  it.each(EXTENSIONS)(
    "keeps valid module references exact in %s files",
    (extension) => {
      const fileName = `src/valid${extension}`;
      const result = extractModuleRefsFromSource(
        fileName,
        validSource(extension),
        scriptKindForPath(fileName)
      );

      expect(result.parseFailed).toBe(false);
      expect(result.refs).toHaveLength(1);
      expect(result.refs[0]).toMatchObject({
        specifier: "./target",
        lineStart: 1,
        lineEnd: 1,
      });
    }
  );

  it.each(EXTENSIONS)(
    "excludes multiline comment bodies from %s source lines",
    (extension) => {
      const fileName = `src/complexity${extension}`;
      const scriptKind = scriptKindForPath(fileName);
      const source = [
        "const before = 1;",
        "/*",
        "plain comment body",
        "another plain comment body",
        "*/ const after = before + 1;",
      ].join("\n");

      const result = computeAstComplexity(source, fileName, scriptKind);

      expect(result.loc).toBe(2);
      expect(result.branchCount).toBe(0);
    }
  );

  it("keeps executable lines that share a block-comment boundary", () => {
    const source = [
      "/* comment */ const first = 1;",
      "const second = first + 1; /*",
      "plain comment body",
      "*/ const third = second + 1;",
    ].join("\n");

    expect(
      computeAstComplexity(source, "src/inline.ts", ts.ScriptKind.TS).loc
    ).toBe(3);
  });
});
