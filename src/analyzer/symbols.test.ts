import fs from "fs";
import os from "os";
import path from "path";
import { afterEach, describe, expect, it } from "vitest";
import { extractSymbols } from "./symbols";

const workspaces: string[] = [];

function createWorkspace(): string {
  const workspace = fs.mkdtempSync(path.join(os.tmpdir(), "repoatlas-symbols-"));
  workspaces.push(workspace);
  return workspace;
}

function writeFile(workspace: string, rel: string, content: string): void {
  const fullPath = path.join(workspace, rel);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, content, "utf8");
}

afterEach(() => {
  for (const workspace of workspaces.splice(0)) {
    fs.rmSync(workspace, { recursive: true, force: true });
  }
});

describe("extractSymbols", () => {
  it("skips ignored, missing, and unreadable entries", () => {
    const workspace = createWorkspace();
    writeFile(workspace, "dist/ignored.ts", "export function ignored() {}");
    fs.mkdirSync(path.join(workspace, "src/unreadable.ts"), {
      recursive: true,
    });
    writeFile(workspace, "src/valid.ts", "export function valid() {}");

    expect(
      extractSymbols(workspace, [
        "dist/ignored.ts",
        "src/missing.ts",
        "src/unreadable.ts",
        "src/valid.ts",
      ])
    ).toEqual([
      { name: "valid", kind: "function", path: "src/valid.ts" },
    ]);
  });

  it("extracts exported TypeScript functions and components once", () => {
    const workspace = createWorkspace();
    writeFile(
      workspace,
      "src/surfaces.tsx",
      [
        "export async function loadCandidate() {}",
        "export const saveCandidate = () => {};",
        "export default function CandidateCard() { return null; }",
        "export function CandidatePanel() { return null; }",
      ].join("\n")
    );

    expect(extractSymbols(workspace, ["src/surfaces.tsx"])).toEqual([
      {
        name: "loadCandidate",
        kind: "function",
        path: "src/surfaces.tsx",
      },
      {
        name: "CandidatePanel",
        kind: "component",
        path: "src/surfaces.tsx",
      },
      {
        name: "saveCandidate",
        kind: "function",
        path: "src/surfaces.tsx",
      },
      {
        name: "CandidateCard",
        kind: "component",
        path: "src/surfaces.tsx",
      },
    ]);
  });

  it("ignores TypeScript and JavaScript symbols inside comments and literals", () => {
    const workspace = createWorkspace();
    writeFile(
      workspace,
      "src/typescript.tsx",
      [
        "// export function CommentedFunction() {}",
        "/* export const BlockCommented = () => {}; */",
        "const stringExample = \"export function StringFunction() {}\";",
        "const templateExample = `export default function TemplateComponent() {}`;",
        "export function RealTypeScriptFunction() {}",
        "export const RealTypeScriptComponent = () => null;",
      ].join("\n")
    );
    writeFile(
      workspace,
      "src/javascript.jsx",
      [
        "// export default function CommentedComponent() {}",
        "const example = 'export const StringConstant = () => {}';",
        "export default function RealJavaScriptComponent() { return null; }",
      ].join("\n")
    );

    expect(
      extractSymbols(workspace, [
        "src/typescript.tsx",
        "src/javascript.jsx",
      ])
    ).toEqual([
      {
        name: "RealTypeScriptFunction",
        kind: "component",
        path: "src/typescript.tsx",
      },
      {
        name: "RealTypeScriptComponent",
        kind: "component",
        path: "src/typescript.tsx",
      },
      {
        name: "RealJavaScriptComponent",
        kind: "component",
        path: "src/javascript.jsx",
      },
    ]);
  });

  it("labels only exact API route modules as routes", () => {
    const workspace = createWorkspace();
    writeFile(
      workspace,
      "src/app/api/reports/route.ts",
      "const runtime = \"nodejs\";"
    );
    writeFile(
      workspace,
      "src/app/api/reports/route.helpers.ts",
      "export function parseRequest() {}"
    );

    expect(
      extractSymbols(workspace, [
        "src/app/api/reports/route.ts",
        "src/app/api/reports/route.helpers.ts",
      ])
    ).toEqual([
      {
        name: "route",
        kind: "route",
        path: "src/app/api/reports/route.ts",
      },
      {
        name: "parseRequest",
        kind: "function",
        path: "src/app/api/reports/route.helpers.ts",
      },
    ]);
  });

  it("fails closed on malformed TypeScript while preserving route classification", () => {
    const workspace = createWorkspace();
    writeFile(
      workspace,
      "src/app/api/reports/route.ts",
      [
        "export function recoveredFromInvalidSource() {}",
        "const broken = \"unterminated;",
      ].join("\n")
    );

    expect(
      extractSymbols(workspace, ["src/app/api/reports/route.ts"])
    ).toEqual([
      {
        name: "route",
        kind: "route",
        path: "src/app/api/reports/route.ts",
      },
    ]);
  });

  it("extracts Python functions and classes across files", () => {
    const workspace = createWorkspace();
    writeFile(
      workspace,
      "src/main.py",
      ["def create_app():", "    return None", "class CandidateBrief:"].join(
        "\n"
      )
    );
    writeFile(workspace, "src/worker.py", "def analyze_repository():\n    pass");

    expect(extractSymbols(workspace, ["src/main.py", "src/worker.py"])).toEqual([
      { name: "create_app", kind: "function", path: "src/main.py" },
      { name: "CandidateBrief", kind: "class", path: "src/main.py" },
      {
        name: "analyze_repository",
        kind: "function",
        path: "src/worker.py",
      },
    ]);
  });

  it("ignores Python symbols inside comments, strings, and docstrings", () => {
    const workspace = createWorkspace();
    writeFile(
      workspace,
      "src/non_code.py",
      [
        "# def commented_function():",
        "\"def string_function():\"",
        "'''",
        "class DocstringClass:",
        "    pass",
        "'''",
        "def real_function():",
        "    return None",
        "class RealClass:",
        "    pass",
      ].join("\n")
    );

    expect(extractSymbols(workspace, ["src/non_code.py"])).toEqual([
      { name: "real_function", kind: "function", path: "src/non_code.py" },
      { name: "RealClass", kind: "class", path: "src/non_code.py" },
    ]);
  });

  it("extracts public Java classes", () => {
    const workspace = createWorkspace();
    writeFile(
      workspace,
      "src/main/java/com/example/Application.java",
      "public class Application {}"
    );

    expect(
      extractSymbols(workspace, [
        "src/main/java/com/example/Application.java",
      ])
    ).toEqual([
      {
        name: "Application",
        kind: "class",
        path: "src/main/java/com/example/Application.java",
      },
    ]);
  });

  it("ignores Java classes inside comments, literals, and text blocks", () => {
    const workspace = createWorkspace();
    writeFile(
      workspace,
      "src/main/java/com/example/RealApplication.java",
      [
        "// public class LineCommentClass {}",
        "/* public class BlockCommentClass {} */",
        "String example = \"public class StringClass {}\";",
        "char marker = 'x'; // public class CharacterCommentClass {}",
        'String textBlock = """',
        "public class TextBlockClass {}",
        '""";',
        "public class RealApplication {}",
      ].join("\n")
    );

    expect(
      extractSymbols(workspace, [
        "src/main/java/com/example/RealApplication.java",
      ])
    ).toEqual([
      {
        name: "RealApplication",
        kind: "class",
        path: "src/main/java/com/example/RealApplication.java",
      },
    ]);
  });

  it("caps the returned symbol inventory at 50", () => {
    const workspace = createWorkspace();
    const exports = Array.from(
      { length: 55 },
      (_, index) => `export const symbol${index} = ${index};`
    ).join("\n");
    writeFile(workspace, "src/many.ts", exports);

    const symbols = extractSymbols(workspace, ["src/many.ts"]);

    expect(symbols).toHaveLength(50);
    expect(symbols[0]?.name).toBe("symbol0");
    expect(symbols[49]?.name).toBe("symbol49");
  });
});
