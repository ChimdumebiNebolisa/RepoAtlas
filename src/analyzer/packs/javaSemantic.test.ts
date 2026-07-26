import fs from "fs";
import os from "os";
import path from "path";
import { describe, expect, it } from "vitest";
import type { IndexingPipelineResult } from "../pipeline";
import { runJavaPack } from "./java";
import {
  collectSamePackageRefs,
  extractImportSpecifiers,
} from "./javaSemantic";
import { packageNameFromSource } from "./javaShared";

function temporaryWorkspace(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "repoatlas-java-semantic-"));
}

function writeFiles(workspace: string, files: Record<string, string>): void {
  for (const [relativePath, content] of Object.entries(files)) {
    const fullPath = path.join(workspace, relativePath);
    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
    fs.writeFileSync(fullPath, content, "utf-8");
  }
}

function buildPipeline(filePaths: string[]): IndexingPipelineResult {
  return {
    folder_map: { path: ".", type: "dir", children: [] },
    run_commands: [],
    contribute_signals: { key_docs: [], ci_configs: [] },
    file_metadata: new Map(
      filePaths.map((filePath) => [
        filePath,
        {
          path: filePath,
          size: 100,
          extension: path.extname(filePath),
          language: filePath.endsWith(".java") ? "java" : "unknown",
        },
      ])
    ),
    key_docs: [],
    ci_configs: [],
    warnings: [],
  };
}

describe("extractImportSpecifiers", () => {
  it("ignores import-looking lines inside comments and text blocks", () => {
    const content = [
      "package com.example;",
      "import com.example.real.RealType;",
      "import static com.example.util.Helpers.call;",
      "import com.example.wildcard.*;",
      "// import com.example.comment.LineCommentType;",
      "/*",
      " import com.example.comment.BlockCommentType;",
      "*/",
      'String example = "import com.example.literal.StringType;";',
      "String docs = \"\"\"",
      " import com.example.literal.TextBlockType;",
      ' "quoted example"',
      "\"\"\";",
    ].join("\n");

    expect(extractImportSpecifiers(content)).toEqual([
      "com.example.real.RealType",
      "com.example.util.Helpers.call",
      "com.example.wildcard.*",
    ]);
  });

  it("deduplicates legitimate static and wildcard imports in source order", () => {
    const content = [
      "import static com.example.util.Helpers.call;",
      "import static com.example.util.Helpers.*;",
      "import com.example.services.*;",
      "import com.example.services.*;",
    ].join("\n");

    expect(extractImportSpecifiers(content)).toEqual([
      "com.example.util.Helpers.call",
      "com.example.util.Helpers",
      "com.example.services.*",
    ]);
  });

  it("fails closed after unterminated non-code regions", () => {
    expect(
      extractImportSpecifiers([
        "import com.example.RealType;",
        "/*",
        "import com.example.UnsupportedType;",
      ].join("\n"))
    ).toEqual(["com.example.RealType"]);

    expect(
      extractImportSpecifiers([
        "import com.example.RealType;",
        "String docs = \"\"\"",
        "import com.example.UnsupportedType;",
      ].join("\n"))
    ).toEqual(["com.example.RealType"]);
  });
});

describe("collectSamePackageRefs", () => {
  it("ignores sibling type names inside comments and every literal form", () => {
    const selfPath = "src/main/java/com/example/App.java";
    const siblings = [
      selfPath,
      "src/main/java/com/example/ExecutableSibling.java",
      "src/main/java/com/example/LineCommentSibling.java",
      "src/main/java/com/example/BlockCommentSibling.java",
      "src/main/java/com/example/StringSibling.java",
      "src/main/java/com/example/X.java",
      "src/main/java/com/example/TextBlockSibling.java",
      "src/main/java/com/example/not-a-type.java",
    ];
    const content = [
      "package com.example;",
      "class App {",
      "  ExecutableSibling value;",
      "  // LineCommentSibling",
      "  /* BlockCommentSibling */",
      '  String name = "StringSibling";',
      "  char marker = 'X';",
      "  String docs = \"\"\"",
      '    \\""" TextBlockSibling',
      "    \"\"\";",
      "}",
    ].join("\n");

    expect(collectSamePackageRefs(content, selfPath, siblings)).toEqual([
      "src/main/java/com/example/ExecutableSibling.java",
    ]);
  });
});

describe("packageNameFromSource", () => {
  it("uses only an executable package declaration", () => {
    const content = [
      "/* package com.example.unsupported; */",
      "String docs = \"\"\"",
      "package com.example.alsoUnsupported;",
      "\"\"\";",
      "package com.example.supported;",
    ].join("\n");

    expect(packageNameFromSource(content)).toBe("com.example.supported");
  });
});

describe("buildJavaSemanticGraph", () => {
  it("creates edges only for executable imports and sibling references", () => {
    const workspace = temporaryWorkspace();
    const app = "src/main/java/com/example/App.java";
    const executableImport =
      "src/main/java/com/example/real/ExecutableImport.java";
    const executableSibling =
      "src/main/java/com/example/ExecutableSibling.java";
    const unsupportedImport =
      "src/main/java/com/example/docs/UnsupportedImport.java";
    const unsupportedSibling =
      "src/main/java/com/example/UnsupportedSibling.java";
    const files = [
      app,
      executableImport,
      executableSibling,
      unsupportedImport,
      unsupportedSibling,
    ];

    writeFiles(workspace, {
      [app]: [
        "package com.example;",
        "import com.example.real.ExecutableImport;",
        "/* import com.example.docs.UnsupportedImport; */",
        "class App {",
        "  ExecutableImport imported;",
        "  ExecutableSibling sibling;",
        "  String docs = \"\"\"",
        '    "example" UnsupportedSibling',
        "    import com.example.docs.UnsupportedImport;",
        "    \"\"\";",
        "}",
      ].join("\n"),
      [executableImport]:
        "package com.example.real; public class ExecutableImport {}",
      [executableSibling]:
        "package com.example; public class ExecutableSibling {}",
      [unsupportedImport]:
        "package com.example.docs; public class UnsupportedImport {}",
      [unsupportedSibling]:
        "package com.example; public class UnsupportedSibling {}",
    });

    try {
      const result = runJavaPack(workspace, buildPipeline(files));
      expect(result.imports.get(app)).toEqual(
        new Set([executableImport, executableSibling])
      );
      expect(result.fanOut.get(app)).toBe(2);
      expect(result.fanIn.get(unsupportedImport)).toBe(0);
      expect(result.fanIn.get(unsupportedSibling)).toBe(0);
    } finally {
      fs.rmSync(workspace, { recursive: true, force: true });
    }
  });
});
