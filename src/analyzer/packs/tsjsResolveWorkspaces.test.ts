import fs from "fs";
import os from "os";
import path from "path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { discoverWorkspacePackages } from "./tsjsResolveWorkspaces";

function writeWorkspace(files: Record<string, string>): string {
  const workspace = fs.mkdtempSync(
    path.join(os.tmpdir(), "repoatlas-ts-workspaces-")
  );
  for (const [relPath, content] of Object.entries(files)) {
    const fullPath = path.join(workspace, relPath);
    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
    fs.writeFileSync(fullPath, content, "utf-8");
  }
  return workspace;
}

function packageRecord(name: string, rootRel: string) {
  return {
    name,
    rootRel,
    packageJsonRel:
      rootRel === "." ? "package.json" : `${rootRel}/package.json`,
  };
}

describe("workspace package discovery", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("rejects traversal, absolute, unsupported glob, and symlink roots", () => {
    const workspace = writeWorkspace({
      "package.json": JSON.stringify({
        name: "root",
        workspaces: [
          "../outside",
          "/packages/absolute",
          "C:/packages/windows",
          "packages/**/deep",
          "packages/*/plugins/*",
          "packages/link",
        ],
      }),
      "packages/absolute/package.json": JSON.stringify({ name: "absolute" }),
      "C:/packages/windows/package.json": JSON.stringify({ name: "windows" }),
    });
    const outside = path.join(path.dirname(workspace), "outside");
    fs.mkdirSync(outside, { recursive: true });
    fs.writeFileSync(
      path.join(outside, "package.json"),
      JSON.stringify({ name: "outside" }),
      "utf-8"
    );
    fs.mkdirSync(path.join(workspace, "packages"), { recursive: true });
    fs.symlinkSync(outside, path.join(workspace, "packages/link"), "dir");

    try {
      expect(discoverWorkspacePackages(workspace)).toEqual([
        packageRecord("root", "."),
      ]);
    } finally {
      fs.rmSync(workspace, { recursive: true, force: true });
      fs.rmSync(outside, { recursive: true, force: true });
    }
  });

  it("deduplicates repeated roots and keeps valid nested packages", () => {
    const workspace = writeWorkspace({
      "package.json": JSON.stringify({
        name: "root",
        workspaces: {
          packages: [
            "packages/*",
            "packages/app",
            "packages/app/plugins/*",
            "packages/*",
            "missing",
            "missing/*",
          ],
        },
      }),
      "packages/app/package.json": JSON.stringify({ name: "@acme/app" }),
      "packages/app/plugins/auth/package.json": JSON.stringify({
        name: "@acme/auth",
      }),
      "packages/no-manifest/README.md": "No package manifest.\n",
    });

    try {
      expect(discoverWorkspacePackages(workspace)).toEqual([
        packageRecord("root", "."),
        packageRecord("@acme/app", "packages/app"),
        packageRecord("@acme/auth", "packages/app/plugins/auth"),
      ]);
    } finally {
      fs.rmSync(workspace, { recursive: true, force: true });
    }
  });

  it("ignores malformed npm workspace entries without aborting discovery", () => {
    const workspace = writeWorkspace({
      "package.json": JSON.stringify({
        name: "root",
        workspaces: [null, 42, {}, "", "packages/valid"],
      }),
      "packages/valid/package.json": JSON.stringify({ name: "@acme/valid" }),
    });

    try {
      expect(discoverWorkspacePackages(workspace)).toEqual([
        packageRecord("root", "."),
        packageRecord("@acme/valid", "packages/valid"),
      ]);
    } finally {
      fs.rmSync(workspace, { recursive: true, force: true });
    }
  });

  it("rejects invalid names and skips unreadable package manifests", () => {
    const workspace = writeWorkspace({
      "package.json": JSON.stringify({
        name: "root",
        workspaces: ["packages/*"],
      }),
      "packages/valid/package.json": JSON.stringify({ name: "@acme/valid" }),
      "packages/blank/package.json": JSON.stringify({ name: "   " }),
      "packages/broken-scope/package.json": JSON.stringify({ name: "@broken" }),
      "packages/subpath/package.json": JSON.stringify({ name: "pkg/private" }),
      "packages/unreadable/package.json": JSON.stringify({
        name: "@acme/unreadable",
      }),
    });
    const unreadableManifest = path.join(
      workspace,
      "packages/unreadable/package.json"
    );
    const readFileSync = fs.readFileSync.bind(fs);
    vi.spyOn(fs, "readFileSync").mockImplementation((filePath, ...args) => {
      if (path.resolve(String(filePath)) === unreadableManifest) {
        throw new Error("unreadable");
      }
      return readFileSync(filePath, ...args);
    });

    try {
      expect(discoverWorkspacePackages(workspace)).toEqual([
        packageRecord("root", "."),
        packageRecord("@acme/valid", "packages/valid"),
      ]);
    } finally {
      fs.rmSync(workspace, { recursive: true, force: true });
    }
  });

  it("degrades safely when a workspace directory cannot be read", () => {
    const workspace = writeWorkspace({
      "package.json": JSON.stringify({
        name: "root",
        workspaces: ["packages/*"],
      }),
      "packages/app/package.json": JSON.stringify({ name: "@acme/app" }),
    });
    const packagesDirectory = path.join(workspace, "packages");
    const readdirSync = fs.readdirSync.bind(fs);
    vi.spyOn(fs, "readdirSync").mockImplementation((directory, ...args) => {
      if (path.resolve(String(directory)) === packagesDirectory) {
        throw new Error("unreadable");
      }
      return readdirSync(directory, ...args);
    });

    try {
      expect(discoverWorkspacePackages(workspace)).toEqual([
        packageRecord("root", "."),
      ]);
    } finally {
      fs.rmSync(workspace, { recursive: true, force: true });
    }
  });

  it("skips a workspace root when its real path cannot be resolved", () => {
    const workspace = writeWorkspace({
      "package.json": JSON.stringify({
        name: "root",
        workspaces: ["packages/app"],
      }),
      "packages/app/package.json": JSON.stringify({ name: "@acme/app" }),
    });
    const appDirectory = path.join(workspace, "packages/app");
    const realpathSync = fs.realpathSync.bind(fs);
    vi.spyOn(fs, "realpathSync").mockImplementation((candidate, ...args) => {
      if (path.resolve(String(candidate)) === appDirectory) {
        throw new Error("unreadable");
      }
      return realpathSync(candidate, ...args);
    });

    try {
      expect(discoverWorkspacePackages(workspace)).toEqual([
        packageRecord("root", "."),
      ]);
    } finally {
      fs.rmSync(workspace, { recursive: true, force: true });
    }
  });

  it("parses bounded pnpm lists and stops at the next root key", () => {
    const workspace = writeWorkspace({
      "package.json": JSON.stringify({ name: "root" }),
      "pnpm-workspace.yaml": [
        "packages:",
        "  - 'packages/app'",
        "catalog:",
        "  react: 19.0.0",
        "  - packages/ignored",
      ].join("\n"),
      "packages/app/package.json": JSON.stringify({ name: "@acme/app" }),
      "packages/ignored/package.json": JSON.stringify({
        name: "@acme/ignored",
      }),
    });

    try {
      expect(discoverWorkspacePackages(workspace)).toEqual([
        packageRecord("root", "."),
        packageRecord("@acme/app", "packages/app"),
      ]);
    } finally {
      fs.rmSync(workspace, { recursive: true, force: true });
    }
  });

  it("ignores malformed and unreadable pnpm workspace metadata", () => {
    const malformed = writeWorkspace({
      "package.json": JSON.stringify({ name: "root" }),
      "pnpm-workspace.yaml": [
        "packages: not-a-list",
        "  - packages/hidden",
      ].join("\n"),
      "packages/hidden/package.json": JSON.stringify({ name: "@acme/hidden" }),
    });
    try {
      expect(discoverWorkspacePackages(malformed)).toEqual([
        packageRecord("root", "."),
      ]);
    } finally {
      fs.rmSync(malformed, { recursive: true, force: true });
    }

    const unreadable = writeWorkspace({
      "package.json": JSON.stringify({ name: "root" }),
      "pnpm-workspace.yaml": "packages:\n  - packages/*\n",
      "packages/app/package.json": JSON.stringify({ name: "@acme/app" }),
    });
    const pnpmPath = path.join(unreadable, "pnpm-workspace.yaml");
    const readFileSync = fs.readFileSync.bind(fs);
    vi.spyOn(fs, "readFileSync").mockImplementation((filePath, ...args) => {
      if (path.resolve(String(filePath)) === pnpmPath) {
        throw new Error("unreadable");
      }
      return readFileSync(filePath, ...args);
    });
    try {
      expect(discoverWorkspacePackages(unreadable)).toEqual([
        packageRecord("root", "."),
      ]);
    } finally {
      fs.rmSync(unreadable, { recursive: true, force: true });
    }
  });
});
