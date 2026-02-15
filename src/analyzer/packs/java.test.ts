import fs from "fs";
import os from "os";
import path from "path";
import { describe, expect, it } from "vitest";
import {
  runJavaPack,
  computeComplexitySignals,
  extractImportSpecifiers,
} from "./java";
import type { IndexingPipelineResult } from "../pipeline";

const relKey = (...segments: string[]) => path.join(...segments);
const normalizeKey = (value: string) => value.replace(/\\/g, "/");

function writeWorkspace(files: Record<string, string>): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "repoatlas-java-pack-"));
  for (const [relPath, content] of Object.entries(files)) {
    const fullPath = path.join(dir, relPath);
    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
    fs.writeFileSync(fullPath, content, "utf-8");
  }
  return dir;
}

function buildPipeline(filePaths: string[]): IndexingPipelineResult {
  const file_metadata = new Map<
    string,
    { path: string; size: number; extension: string; language: string }
  >();

  for (const filePath of filePaths) {
    const ext = path.extname(filePath);
    file_metadata.set(filePath, {
      path: filePath,
      size: 100,
      extension: ext,
      language: ext === ".java" ? "java" : "unknown",
    });
  }

  return {
    folder_map: { path: ".", type: "dir", children: [] },
    run_commands: [],
    contribute_signals: { key_docs: [], ci_configs: [] },
    file_metadata,
    key_docs: [],
    ci_configs: [],
    warnings: [],
  };
}

describe("runJavaPack import resolution", () => {
  it("resolves package-qualified imports to files", () => {
    const workspace = writeWorkspace({
      [relKey("src", "main", "java", "com", "example", "App.java")]: `package com.example;
import com.example.service.UserService;
public class App { public static void main(String[] args) { UserService.greet("x"); } }
`,
      [relKey("src", "main", "java", "com", "example", "service", "UserService.java")]: `package com.example.service;
public class UserService { public static String greet(String s) { return s; } }
`,
    });
    const appFile = relKey("src", "main", "java", "com", "example", "App.java");
    const serviceFile = relKey(
      "src",
      "main",
      "java",
      "com",
      "example",
      "service",
      "UserService.java"
    );
    const pipeline = buildPipeline([appFile, serviceFile]);

    try {
      const result = runJavaPack(workspace, pipeline);
      expect(result.imports.get(appFile)).toContain(serviceFile);
    } finally {
      fs.rmSync(workspace, { recursive: true, force: true });
    }
  });

  it("handles wildcard imports", () => {
    const workspace = writeWorkspace({
      [relKey("src", "main", "java", "com", "example", "App.java")]: `package com.example;
import com.example.util.*;
public class App { public static void main(String[] args) { StringUtils.format("x", "y"); } }
`,
      [relKey("src", "main", "java", "com", "example", "util", "StringUtils.java")]: `package com.example.util;
public class StringUtils { public static String format(String a, String b) { return a; } }
`,
    });
    const appFile = relKey("src", "main", "java", "com", "example", "App.java");
    const utilFile = relKey(
      "src",
      "main",
      "java",
      "com",
      "example",
      "util",
      "StringUtils.java"
    );
    const pipeline = buildPipeline([appFile, utilFile]);

    try {
      const result = runJavaPack(workspace, pipeline);
      expect(result.imports.get(appFile)).toContain(utilFile);
    } finally {
      fs.rmSync(workspace, { recursive: true, force: true });
    }
  });

  it("ignores external dependencies", () => {
    const workspace = writeWorkspace({
      [relKey("src", "main", "java", "com", "example", "App.java")]: `package com.example;
import java.util.List;
import org.springframework.boot.SpringApplication;
import com.example.service.UserService;
public class App { }
`,
      [relKey("src", "main", "java", "com", "example", "service", "UserService.java")]: `package com.example.service;
public class UserService { }
`,
    });
    const appFile = relKey("src", "main", "java", "com", "example", "App.java");
    const serviceFile = relKey(
      "src",
      "main",
      "java",
      "com",
      "example",
      "service",
      "UserService.java"
    );
    const pipeline = buildPipeline([appFile, serviceFile]);

    try {
      const result = runJavaPack(workspace, pipeline);
      expect(result.imports.get(appFile)).toEqual(new Set([serviceFile]));
    } finally {
      fs.rmSync(workspace, { recursive: true, force: true });
    }
  });
});

describe("runJavaPack entrypoint detection", () => {
  it("detects main() entrypoints", () => {
    const workspace = writeWorkspace({
      [relKey("src", "main", "java", "com", "example", "Main.java")]: `package com.example;
public class Main {
  public static void main(String[] args) { }
}
`,
      [relKey("src", "main", "java", "com", "example", "Util.java")]: `package com.example;
public class Util { }
`,
    });
    const mainFile = relKey("src", "main", "java", "com", "example", "Main.java");
    const utilFile = relKey("src", "main", "java", "com", "example", "Util.java");
    const pipeline = buildPipeline([mainFile, utilFile]);

    try {
      const result = runJavaPack(workspace, pipeline);
      expect(result.entrypoints.has(mainFile)).toBe(true);
      expect(result.entrypoints.has(utilFile)).toBe(false);
    } finally {
      fs.rmSync(workspace, { recursive: true, force: true });
    }
  });

  it("detects @SpringBootApplication classes", () => {
    const workspace = writeWorkspace({
      [relKey("src", "main", "java", "com", "example", "App.java")]: `package com.example;
import org.springframework.boot.autoconfigure.SpringBootApplication;
@SpringBootApplication
public class App { }
`,
    });
    const appFile = relKey("src", "main", "java", "com", "example", "App.java");
    const pipeline = buildPipeline([appFile]);

    try {
      const result = runJavaPack(workspace, pipeline);
      expect(result.entrypoints.has(appFile)).toBe(true);
    } finally {
      fs.rmSync(workspace, { recursive: true, force: true });
    }
  });

  it("detects @RestController classes", () => {
    const workspace = writeWorkspace({
      [relKey("src", "main", "java", "com", "example", "UserController.java")]: `package com.example;
import org.springframework.web.bind.annotation.RestController;
@RestController
public class UserController { }
`,
    });
    const ctrlFile = relKey(
      "src",
      "main",
      "java",
      "com",
      "example",
      "UserController.java"
    );
    const pipeline = buildPipeline([ctrlFile]);

    try {
      const result = runJavaPack(workspace, pipeline);
      expect(result.entrypoints.has(ctrlFile)).toBe(true);
    } finally {
      fs.rmSync(workspace, { recursive: true, force: true });
    }
  });
});

describe("runJavaPack test proximity", () => {
  it("scores 100 for exact test mirror (FooTest.java)", () => {
    const workspace = writeWorkspace({
      [relKey("src", "main", "java", "com", "example", "UserService.java")]: `package com.example;
public class UserService { }
`,
      [relKey("src", "test", "java", "com", "example", "UserServiceTest.java")]: `package com.example;
public class UserServiceTest { }
`,
    });
    const prodFile = relKey(
      "src",
      "main",
      "java",
      "com",
      "example",
      "UserService.java"
    );
    const testFile = relKey(
      "src",
      "test",
      "java",
      "com",
      "example",
      "UserServiceTest.java"
    );
    const pipeline = buildPipeline([prodFile, testFile]);

    try {
      const result = runJavaPack(workspace, pipeline);
      expect(result.testProximity?.get(prodFile)).toBe(100);
    } finally {
      fs.rmSync(workspace, { recursive: true, force: true });
    }
  });

  it("scores 90 for IT suffix (FooIT.java)", () => {
    const workspace = writeWorkspace({
      [relKey("src", "main", "java", "com", "example", "UserService.java")]: `package com.example;
public class UserService { }
`,
      [relKey("src", "test", "java", "com", "example", "UserServiceIT.java")]: `package com.example;
public class UserServiceIT { }
`,
    });
    const prodFile = relKey(
      "src",
      "main",
      "java",
      "com",
      "example",
      "UserService.java"
    );
    const pipeline = buildPipeline([
      prodFile,
      relKey("src", "test", "java", "com", "example", "UserServiceIT.java"),
    ]);

    try {
      const result = runJavaPack(workspace, pipeline);
      expect(result.testProximity?.get(prodFile)).toBe(90);
    } finally {
      fs.rmSync(workspace, { recursive: true, force: true });
    }
  });

  it("scores 0 for uncovered files", () => {
    const workspace = writeWorkspace({
      [relKey("src", "main", "java", "com", "example", "Uncovered.java")]: `package com.example;
public class Uncovered { }
`,
    });
    const prodFile = relKey(
      "src",
      "main",
      "java",
      "com",
      "example",
      "Uncovered.java"
    );
    const pipeline = buildPipeline([prodFile]);

    try {
      const result = runJavaPack(workspace, pipeline);
      expect(result.testProximity?.get(prodFile)).toBe(0);
    } finally {
      fs.rmSync(workspace, { recursive: true, force: true });
    }
  });
});

describe("computeComplexitySignals", () => {
  it("computes LOC excluding comments", () => {
    const simple = "public class X {\n  void m() { }\n}\n";
    const withComments = "// comment\npublic class X {\n  /* block */\n  void m() { }\n}\n";
    const s1 = computeComplexitySignals(simple);
    const s2 = computeComplexitySignals(withComments);
    expect(s1.loc).toBeGreaterThan(0);
    expect(s2.loc).toBe(s1.loc);
  });

  it("counts branch keywords", () => {
    const content = "if (x) { } else if (y) { } for (;;) { } while (z) { } catch (e) { }";
    const sig = computeComplexitySignals(content);
    expect(sig.branchCount).toBeGreaterThan(0);
  });

  it("measures nesting depth", () => {
    const simple = "class X { void m() { } }";
    const nested = "class X { void m() { if (x) { for (;;) { } } } }";
    const s1 = computeComplexitySignals(simple);
    const s2 = computeComplexitySignals(nested);
    expect(s2.maxNesting).toBeGreaterThan(s1.maxNesting);
  });
});

describe("extractImportSpecifiers", () => {
  it("extracts package imports", () => {
    const content = `package com.example;
import com.example.service.UserService;
import java.util.List;
import static com.example.util.Utils.helper;
`;
    const specs = extractImportSpecifiers(content);
    expect(specs).toContain("com.example.service.UserService");
    expect(specs).toContain("java.util.List");
    expect(specs).toContain("com.example.util.Utils.helper");
  });
});

describe("runJavaPack architecture", () => {
  it("reduces to package-level graph", () => {
    const workspace = writeWorkspace({
      [relKey("src", "main", "java", "com", "example", "a", "A.java")]: `package com.example.a;
import com.example.b.B;
public class A { }
`,
      [relKey("src", "main", "java", "com", "example", "a", "Helper.java")]: `package com.example.a;
public class Helper { }
`,
      [relKey("src", "main", "java", "com", "example", "b", "B.java")]: `package com.example.b;
public class B { }
`,
    });
    const aFile = relKey("src", "main", "java", "com", "example", "a", "A.java");
    const aHelper = relKey(
      "src",
      "main",
      "java",
      "com",
      "example",
      "a",
      "Helper.java"
    );
    const bFile = relKey("src", "main", "java", "com", "example", "b", "B.java");
    const pipeline = buildPipeline([aFile, aHelper, bFile]);

    try {
      const result = runJavaPack(workspace, pipeline);
      const nodeIds = new Set(result.architecture.nodes.map((n) => normalizeKey(n.id)));
      expect(nodeIds.has("com.example.a")).toBe(true);
      expect(nodeIds.has("com.example.b")).toBe(true);
      expect(result.architecture.edges.some((e) => e.type === "import")).toBe(true);
    } finally {
      fs.rmSync(workspace, { recursive: true, force: true });
    }
  });
});
