import fs from "fs";
import os from "os";
import path from "path";
import { describe, expect, it } from "vitest";
import type { IndexingPipelineResult } from "../pipeline";
import { runJavaPack } from "./java";
import { buildJavaArchitecture } from "./javaArchitecture";
import {
  detectGradleModules,
  detectMavenModules,
  discoverJavaModules,
} from "./javaModules";
import {
  buildJavaSourceIndex,
  isJavaTestFile,
  selectJavaSourceFiles,
} from "./javaSources";

function temporaryWorkspace(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "repoatlas-java-boundary-"));
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

describe("Java module discovery boundaries", () => {
  it("returns an empty result when Maven and Gradle manifests are missing", () => {
    const workspace = temporaryWorkspace();
    try {
      expect(discoverJavaModules(workspace)).toEqual({ maven: [], gradle: [] });
    } finally {
      fs.rmSync(workspace, { recursive: true, force: true });
    }
  });

  it("deduplicates valid modules and ignores malformed module declarations", () => {
    const workspace = temporaryWorkspace();
    writeFiles(workspace, {
      "pom.xml": "<modules><module> api </module><module>api</module><module></module></modules>",
      "settings.gradle": "include(\"web\")\ninclude('web')\ninclude(:broken)",
    });
    try {
      expect(detectMavenModules(workspace)).toEqual(["api"]);
      expect(detectGradleModules(workspace)).toEqual(["web"]);
    } finally {
      fs.rmSync(workspace, { recursive: true, force: true });
    }
  });

  it("falls back safely when manifest paths cannot be read", () => {
    const workspace = temporaryWorkspace();
    fs.mkdirSync(path.join(workspace, "pom.xml"));
    fs.mkdirSync(path.join(workspace, "settings.gradle"));
    try {
      expect(detectMavenModules(workspace)).toEqual([]);
      expect(detectGradleModules(workspace)).toEqual([]);
    } finally {
      fs.rmSync(workspace, { recursive: true, force: true });
    }
  });

  it("uses Kotlin Gradle settings when the Groovy settings file is absent", () => {
    const workspace = temporaryWorkspace();
    writeFiles(workspace, { "settings.gradle.kts": "include(\"service\")" });
    try {
      expect(detectGradleModules(workspace)).toEqual(["service"]);
    } finally {
      fs.rmSync(workspace, { recursive: true, force: true });
    }
  });
});

describe("Java source classification boundaries", () => {
  it("excludes ignored output and dependency paths before analysis", () => {
    const kept = "src/main/java/com/example/App.java";
    const pipeline = buildPipeline([
      kept,
      "target/generated/App.java",
      "module/build/generated/App.java",
      "node_modules/example/App.java",
      "README.md",
    ]);
    expect(selectJavaSourceFiles(pipeline)).toEqual([kept]);
  });

  it("classifies standard and named Java tests across slash styles", () => {
    expect(isJavaTestFile("src/test/java/com/example/SmokeHarness.java")).toBe(true);
    expect(isJavaTestFile("module\\src\\integrationTest\\java\\Check.java")).toBe(true);
    expect(isJavaTestFile("src/main/java/com/example/AppTest.java")).toBe(true);
    expect(isJavaTestFile("src/main/java/com/example/App.java")).toBe(false);
  });

  it("does not promote an unsuffixed test-source class to an application entrypoint", () => {
    const workspace = temporaryWorkspace();
    const app = "src/main/java/com/example/App.java";
    const harness = "src/test/java/com/example/SmokeHarness.java";
    writeFiles(workspace, {
      [app]: "package com.example; public class App { public static void main(String[] args) {} }",
      [harness]: "package com.example; @RestController public class SmokeHarness { public static void main(String[] args) {} }",
    });
    try {
      const result = runJavaPack(workspace, buildPipeline([app, harness]));
      expect(result.testFiles).toContain(harness);
      expect(result.entrypoints).toEqual(new Set([app]));
      expect(result.warnings).not.toContainEqual(expect.stringContaining("Multiple main()"));
    } finally {
      fs.rmSync(workspace, { recursive: true, force: true });
    }
  });

  it("keeps source-backed Spring and JAX-RS entrypoints while excluding tests", () => {
    const workspace = temporaryWorkspace();
    const files = {
      "src/main/java/app/Boot.java": "@SpringBootApplication class Boot {}",
      "src/main/java/app/Runner.java": "class Runner { void start() { SpringApplication.run(Runner.class); } }",
      "src/main/java/app/Controller.java": "@RequestMapping class Controller {}",
      "src/main/java/app/Resource.java": "@Path(\"/items\") class Resource {}",
      "src/test/java/app/ControllerFixture.java": "@Controller class ControllerFixture {}",
    };
    writeFiles(workspace, files);
    try {
      const result = runJavaPack(workspace, buildPipeline(Object.keys(files)));
      expect([...result.entrypoints]).toEqual([
        "src/main/java/app/Boot.java",
        "src/main/java/app/Runner.java",
        "src/main/java/app/Controller.java",
        "src/main/java/app/Resource.java",
      ]);
      expect(result.entrypoints).not.toContain("src/test/java/app/ControllerFixture.java");
    } finally {
      fs.rmSync(workspace, { recursive: true, force: true });
    }
  });

  it("returns bounded empty signals for unreadable source files", () => {
    const workspace = temporaryWorkspace();
    const missing = "src/main/java/com/example/Missing.java";
    try {
      const result = runJavaPack(workspace, buildPipeline([missing]));
      expect(result.entrypoints.size).toBe(0);
      expect(result.imports.get(missing)).toEqual(new Set());
      expect(result.fanIn.get(missing)).toBe(0);
      expect(result.fanOut.get(missing)).toBe(0);
      expect(result.complexity.get(missing)).toBe(0);
      expect(result.loc?.get(missing)).toBe(0);
    } finally {
      fs.rmSync(workspace, { recursive: true, force: true });
    }
  });

  it("returns an empty pack when the repository has no Java sources", () => {
    const result = runJavaPack("/does/not/matter", buildPipeline(["README.md"]));
    expect(result.architecture).toEqual({ nodes: [], edges: [] });
    expect(result.imports.size).toBe(0);
    expect(result.warnings).toEqual([]);
  });

  it("indexes readable default-package and packaged sources", () => {
    const workspace = temporaryWorkspace();
    const files = ["src/Main.java", "src/main/java/app/Service.java"];
    writeFiles(workspace, {
      [files[0]]: "class Main {}",
      [files[1]]: "package app; class Service {}",
    });
    try {
      const index = buildJavaSourceIndex(files, workspace);
      expect(index.fqnToFile.get("Main")).toBe(files[0]);
      expect(index.fqnToFile.get("app.Service")).toBe(files[1]);
      expect(index.packageToFiles.get("")).toEqual([files[0]]);
    } finally {
      fs.rmSync(workspace, { recursive: true, force: true });
    }
  });

  it("caps multiple-main warnings at five source-backed paths", () => {
    const workspace = temporaryWorkspace();
    const files = Object.fromEntries(
      Array.from({ length: 6 }, (_, index) => [
        `src/main/java/app/Main${index}.java`,
        `class Main${index} { public static void main(String[] args) {} }`,
      ])
    );
    writeFiles(workspace, files);
    try {
      const result = runJavaPack(workspace, buildPipeline(Object.keys(files)));
      expect(result.entrypoints.size).toBe(6);
      expect(result.warnings?.[0]).toContain("Main0.java");
      expect(result.warnings?.[0]).not.toContain("Main5.java");
      expect(result.warnings?.[0]).toMatch(/\.\.\.$/);
    } finally {
      fs.rmSync(workspace, { recursive: true, force: true });
    }
  });
});

describe("Java architecture caps", () => {
  it("caps package nodes and edges deterministically", () => {
    const files = Array.from(
      { length: 51 },
      (_, index) => `src/main/java/pkg${index}/Type${index}.java`
    );
    const imports = new Map<string, Set<string>>();
    for (const file of files.slice(0, 50)) {
      imports.set(file, new Set(files.slice(0, 50).filter((target) => target !== file)));
    }
    imports.set(files[50], new Set());

    const result = buildJavaArchitecture(files, imports);
    expect(result.architecture.nodes).toHaveLength(50);
    expect(result.architecture.edges).toHaveLength(200);
    expect(result.warnings).toEqual([
      "Architecture nodes capped at 50 packages (from 51).",
      "Architecture reduced from file-level (51 files) to package-level (50 packages).",
      "Architecture edges capped at 200 links (from 2450).",
    ]);
  });
});

describe("Java pack boundaries", () => {
  it("keeps every production module below the 300-line maintenance cap", () => {
    const moduleNames = [
      "java.ts",
      "javaArchitecture.ts",
      "javaMetrics.ts",
      "javaModules.ts",
      "javaSemantic.ts",
      "javaShared.ts",
      "javaSources.ts",
    ];

    for (const moduleName of moduleNames) {
      const source = fs.readFileSync(path.join(__dirname, moduleName), "utf-8");
      expect(source.split(/\r?\n/).length, moduleName).toBeLessThanOrEqual(300);
    }
  });
});
