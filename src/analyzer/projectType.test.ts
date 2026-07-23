import fs from "fs";
import os from "os";
import path from "path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { detectProjectProfile } from "./projectType";

const workspaces: string[] = [];

function createWorkspace(
  files: Record<string, string>,
  inventory: string[] = Object.keys(files)
): { root: string; inventory: string[] } {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "repoatlas-project-type-"));
  workspaces.push(root);
  for (const [relativePath, content] of Object.entries(files)) {
    const target = path.join(root, relativePath);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, content);
  }
  return { root, inventory };
}

afterEach(() => {
  vi.restoreAllMocks();
  for (const workspace of workspaces.splice(0)) {
    fs.rmSync(workspace, { recursive: true, force: true });
  }
});

describe("detectProjectProfile", () => {
  it("classifies Django from a nested manage.py signal", () => {
    const workspace = createWorkspace({
      "services/web/manage.py": "from django.core.management import execute_from_command_line",
      "services/web/app.py": "print('ready')",
    });

    expect(detectProjectProfile(workspace.root, workspace.inventory)).toEqual({
      type: "django",
      label: "Django application",
      confidence: "high",
      signals: ["manage.py"],
      evidence_refs: [],
    });
  });

  it("classifies Next.js from an app route before package signals", () => {
    const workspace = createWorkspace({
      "package.json": JSON.stringify({ dependencies: { react: "19.0.0" } }),
      "src/app/dashboard/page.tsx": "export default function Page() { return null; }",
    });

    expect(detectProjectProfile(workspace.root, workspace.inventory)).toEqual({
      type: "nextjs-app",
      label: "Next.js application",
      confidence: "high",
      signals: ["src/app/**/page.tsx"],
      evidence_refs: [],
    });
  });

  it("classifies Next.js from its dependency when no app route is present", () => {
    const workspace = createWorkspace({
      "package.json": JSON.stringify({ devDependencies: { next: "16.0.0" } }),
      "pages/index.tsx": "export default function Page() { return null; }",
    });

    expect(detectProjectProfile(workspace.root, workspace.inventory)).toEqual({
      type: "nextjs-app",
      label: "Next.js application",
      confidence: "medium",
      signals: ["next dependency"],
      evidence_refs: [],
    });
  });

  it("reads the detected nested pyproject and classifies FastAPI", () => {
    const workspace = createWorkspace({
      "services/api/pyproject.toml": "[project]\ndependencies = ['fastapi']\n",
      "services/api/main.py": "from fastapi import FastAPI\napp = FastAPI()\n",
    });

    expect(detectProjectProfile(workspace.root, workspace.inventory)).toEqual({
      type: "fastapi",
      label: "FastAPI application",
      confidence: "high",
      signals: ["fastapi in pyproject.toml"],
      evidence_refs: [],
    });
  });

  it("classifies a generic Python project without a FastAPI signal", () => {
    const workspace = createWorkspace({
      "pyproject.toml": "[project]\nname = 'worker'\n",
      "worker.py": "print('ready')\n",
    });

    expect(detectProjectProfile(workspace.root, workspace.inventory)).toEqual({
      type: "python-cli",
      label: "Python project",
      confidence: "medium",
      signals: ["pyproject.toml"],
      evidence_refs: [],
    });
  });

  it("classifies Spring Boot from a readable nested source annotation", () => {
    const workspace = createWorkspace({
      "pom.xml": "<project />",
      "src/main/java/com/example/App.java":
        "package com.example;\n@SpringBootApplication\nclass App {}\n",
    });

    expect(detectProjectProfile(workspace.root, workspace.inventory)).toEqual({
      type: "spring-boot",
      label: "Spring Boot application",
      confidence: "high",
      signals: [
        "src/main/java/com/example/App.java (@SpringBootApplication)",
      ],
      evidence_refs: [],
    });
  });

  it.each(["pom.xml", "build.gradle.kts"])(
    "classifies Java build projects from %s",
    (manifest) => {
      const workspace = createWorkspace({
        [manifest]: "plugins {}",
        "src/main/java/com/example/App.java": "class App {}\n",
      });

      expect(detectProjectProfile(workspace.root, workspace.inventory)).toEqual({
        type: "java-maven-gradle",
        label: "Java Maven/Gradle project",
        confidence: "medium",
        signals: ["pom.xml or build.gradle"],
        evidence_refs: [],
      });
    }
  );

  it.each([
    [{ dependencies: { express: "5.0.0" } }, "express dependency"],
    [{ dependencies: { fastify: "5.0.0" } }, "fastify dependency"],
    [{}, "routes directory"],
  ])("classifies a Node API from %s", (packageJson, signalCase) => {
    const files: Record<string, string> = {
      "package.json": JSON.stringify(packageJson),
      "src/index.ts": "export const ready = true;\n",
    };
    if (signalCase === "routes directory") {
      files["routes/health.ts"] = "export const health = true;\n";
    }
    const workspace = createWorkspace(files);

    expect(detectProjectProfile(workspace.root, workspace.inventory)).toEqual({
      type: "node-api",
      label: "Node API",
      confidence: "medium",
      signals: ["express/fastify or routes/"],
      evidence_refs: [],
    });
  });

  it("classifies React without Next.js as a SPA", () => {
    const workspace = createWorkspace({
      "package.json": JSON.stringify({ dependencies: { react: "19.0.0" } }),
      "src/main.tsx": "export const App = () => null;\n",
    });

    expect(detectProjectProfile(workspace.root, workspace.inventory)).toEqual({
      type: "react-spa",
      label: "React SPA",
      confidence: "medium",
      signals: ["react without next"],
      evidence_refs: [],
    });
  });

  it("classifies a documentation-only repository", () => {
    const workspace = createWorkspace({
      "README.md": "# Guide\n",
      "docs/setup.mdx": "# Setup\n",
    });

    expect(detectProjectProfile(workspace.root, workspace.inventory)).toEqual({
      type: "docs-only",
      label: "Docs-only repository",
      confidence: "high",
      signals: ["no supported source files"],
      evidence_refs: [],
    });
  });

  it.each([
    [{ main: "dist/index.js" }, "main"],
    [{ bin: { repoatlas: "dist/cli.js" } }, "bin"],
  ])("classifies package.json %s as a library", (packageJson, _signalCase) => {
    const workspace = createWorkspace({
      "package.json": JSON.stringify(packageJson),
      "src/index.ts": "export const version = '1';\n",
    });

    expect(detectProjectProfile(workspace.root, workspace.inventory)).toEqual({
      type: "library",
      label: "Library or package",
      confidence: "medium",
      signals: ["package.json main/bin"],
      evidence_refs: [],
    });
  });

  it("returns undefined for an unknown supported-source profile", () => {
    const workspace = createWorkspace({ "cmd/main.go": "package main\n" });

    expect(
      detectProjectProfile(workspace.root, ["cmd/main.go", "src/worker.ts"])
    ).toBeUndefined();
  });

  it.each([
    ["missing package.json", {}, ["package.json", "src/index.ts"]],
    ["malformed package.json", { "package.json": "{" }, ["package.json", "src/index.ts"]],
  ])("handles a %s without throwing", (_case, files, inventory) => {
    const workspace = createWorkspace(files, inventory);

    expect(() => detectProjectProfile(workspace.root, inventory)).not.toThrow();
    expect(detectProjectProfile(workspace.root, inventory)).toBeUndefined();
  });

  it("ignores an unreadable package manifest", () => {
    const workspace = createWorkspace({
      "package.json": JSON.stringify({ dependencies: { next: "16.0.0" } }),
      "src/index.ts": "export const ready = true;\n",
    });
    const originalRead = fs.readFileSync.bind(fs);
    vi.spyOn(fs, "readFileSync").mockImplementation(((file, ...args) => {
      if (String(file).endsWith("package.json")) throw new Error("unreadable");
      return originalRead(file, ...args);
    }) as typeof fs.readFileSync);

    expect(detectProjectProfile(workspace.root, workspace.inventory)).toBeUndefined();
  });

  it("falls back to generic Python when pyproject is missing or unreadable", () => {
    const workspace = createWorkspace(
      { "src/main.py": "print('ready')\n" },
      ["services/api/pyproject.toml", "src/main.py"]
    );

    expect(detectProjectProfile(workspace.root, workspace.inventory)).toEqual({
      type: "python-cli",
      label: "Python project",
      confidence: "medium",
      signals: ["pyproject.toml"],
      evidence_refs: [],
    });
  });

  it("skips unreadable Java sources and retains the build-tool fallback", () => {
    const workspace = createWorkspace({
      "pom.xml": "<project />",
      "src/main/java/App.java": "@SpringBootApplication class App {}\n",
    });
    const originalRead = fs.readFileSync.bind(fs);
    vi.spyOn(fs, "readFileSync").mockImplementation(((file, ...args) => {
      if (String(file).endsWith("App.java")) throw new Error("unreadable");
      return originalRead(file, ...args);
    }) as typeof fs.readFileSync);

    expect(detectProjectProfile(workspace.root, workspace.inventory)).toEqual({
      type: "java-maven-gradle",
      label: "Java Maven/Gradle project",
      confidence: "medium",
      signals: ["pom.xml or build.gradle"],
      evidence_refs: [],
    });
  });

  it("does not read absolute or traversal source paths outside the workspace", () => {
    const workspace = createWorkspace({
      "pom.xml": "<project />",
      "src/main/java/App.java": "class App {}\n",
    });
    const readSpy = vi.spyOn(fs, "readFileSync");

    expect(
      detectProjectProfile(workspace.root, [
        "pom.xml",
        "src/main/java/App.java",
        "../../Outside.java",
        "/tmp/Outside.java",
      ])
    ).toEqual({
      type: "java-maven-gradle",
      label: "Java Maven/Gradle project",
      confidence: "medium",
      signals: ["pom.xml or build.gradle"],
      evidence_refs: [],
    });
    expect(
      readSpy.mock.calls.some(([file]) => String(file).includes("Outside.java"))
    ).toBe(false);
  });
});
