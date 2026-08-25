import fs from "fs";
import os from "os";
import path from "path";
import { afterEach, describe, expect, it } from "vitest";
import { computeSetMetrics } from "../../eval/metrics";
import { detectEntrypoints } from "./entrypoints";

const workspaces: string[] = [];

function writeWorkspace(files: Record<string, string>): string {
  const workspace = fs.mkdtempSync(path.join(os.tmpdir(), "repoatlas-python-entrypoints-"));
  workspaces.push(workspace);
  for (const [relativePath, content] of Object.entries(files)) {
    const fullPath = path.join(workspace, relativePath);
    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
    fs.writeFileSync(fullPath, content, "utf-8");
  }
  return workspace;
}

afterEach(() => {
  for (const workspace of workspaces.splice(0)) {
    fs.rmSync(workspace, { recursive: true, force: true });
  }
});

describe("detectEntrypoints", () => {
  it("recognizes a reversed __main__ guard without accepting nearby lookalikes", () => {
    const workspace = path.join(
      process.cwd(),
      "fixtures",
      "repo-python-reversed-main-guard"
    );
    const expected = JSON.parse(
      fs.readFileSync(path.join(workspace, "expected-entrypoints.json"), "utf-8")
    ) as { entrypoints: string[]; nonEntrypoints: string[] };
    const files = [...expected.entrypoints, ...expected.nonEntrypoints];

    const result = detectEntrypoints(files, workspace);
    const metrics = computeSetMetrics([...result], expected.entrypoints);

    expect(metrics).toMatchObject({
      true_positives: 1,
      false_positives: 0,
      false_negatives: 0,
      precision: 1,
      recall: 1,
    });
    for (const filePath of expected.nonEntrypoints) {
      expect(result.has(filePath)).toBe(false);
    }
  });

  it("requires executable evidence for conventional Python entrypoint names", () => {
    const workspace = path.join(
      process.cwd(),
      "fixtures",
      "repo-python-conventional-entrypoints"
    );
    const expected = JSON.parse(
      fs.readFileSync(path.join(workspace, "expected-entrypoints.json"), "utf-8")
    ) as { entrypoints: string[]; nonEntrypoints: string[] };
    const files = [...expected.nonEntrypoints, ...expected.entrypoints];

    const result = detectEntrypoints(files, workspace);

    expect([...result]).toEqual(expected.entrypoints);
    for (const filePath of expected.nonEntrypoints) {
      expect(result.has(filePath)).toBe(false);
    }
  });

  it("requires executable Django evidence before treating manage.py as an entrypoint", () => {
    const workspace = writeWorkspace({
      "empty/manage.py": "",
      "comment-only/manage.py": [
        "# from django.core.management import execute_from_command_line",
        "# execute_from_command_line([])",
      ].join("\n"),
      "string-only/manage.py": [
        `EXAMPLE = "from django.core.management import execute_from_command_line"`,
        `CALL = "execute_from_command_line([])"`,
      ].join("\n"),
      "genuine/manage.py": [
        "import sys",
        "from django.core.management import execute_from_command_line",
        "",
        `if __name__ == "__main__":`,
        "    execute_from_command_line(sys.argv)",
      ].join("\n"),
    });
    const files = [
      "empty/manage.py",
      "comment-only/manage.py",
      "string-only/manage.py",
      "genuine/manage.py",
    ];

    expect([...detectEntrypoints(files, workspace)]).toEqual(["genuine/manage.py"]);
  });

  it("recognizes conventional names and __main__ modules case-insensitively", () => {
    const workspace = writeWorkspace({
      "MAIN.PY": "print('main')",
      "services/App.py": "print('app')",
      "tools\\CLI.PY": "print('cli')",
    });
    const files = [
      "MAIN.PY",
      "services/App.py",
      "tools\\CLI.PY",
      "pkg/__MAIN__.PY",
      "pkg/helper.py",
    ];

    expect([...detectEntrypoints(files, workspace)]).toEqual([
      "MAIN.PY",
      "services/App.py",
      "tools\\CLI.PY",
      "pkg/__MAIN__.PY",
    ]);
  });

  it("detects real guarded execution but ignores comments and string examples", () => {
    const workspace = writeWorkspace({
      "worker.py": [
        "def run():",
        "    return 1",
        "",
        "if __name__ == '__main__':",
        "    run()",
      ].join("\n"),
      "examples.py": [
        "# if __name__ == '__main__':",
        `EXAMPLE = "if __name__ == '__main__':"`,
        `'''if __name__ == "__main__":'''`,
      ].join("\n"),
    });

    expect([...detectEntrypoints(["worker.py", "examples.py"], workspace)]).toEqual([
      "worker.py",
    ]);
  });

  it("resolves every supported pyproject and setup.py script in root and src layouts", () => {
    const workspace = writeWorkspace({
      "pyproject.toml": [
        "[project]",
        'name = "example"',
        "",
        "[project.scripts]",
        'first = "pkg.first:main"',
        'second-tool = "pkg.second:start"',
        "",
        "[project.optional-dependencies]",
        'test = ["pytest"]',
      ].join("\n"),
      "setup.py": [
        "setup(",
        "  entry_points={",
        `    "console_scripts": [`,
        `      "legacy=pkg.legacy:main",`,
        `      "admin-tool = pkg.admin:run",`,
        "    ],",
        "  },",
        ")",
      ].join("\n"),
      "src/pkg/first.py": "",
      "src/pkg/second.py": "",
      "pkg/legacy.py": "",
      "pkg/admin.py": "",
    });
    const files = [
      "src/pkg/first.py",
      "src/pkg/second.py",
      "pkg/legacy.py",
      "pkg/admin.py",
    ];

    expect([...detectEntrypoints(files, workspace)]).toEqual(files);
  });

  it("deduplicates conventional and configured evidence and ignores missing modules", () => {
    const workspace = writeWorkspace({
      "pyproject.toml": [
        "[project.scripts]",
        'cli = "pkg.cli:main"',
        'missing = "pkg.missing:main"',
      ].join("\n"),
      "src/pkg/cli.py": "",
    });

    expect([...detectEntrypoints(["src/pkg/cli.py"], workspace)]).toEqual([
      "src/pkg/cli.py",
    ]);
  });

  it("continues when manifests are missing or unreadable", () => {
    const workspace = writeWorkspace({
      "worker.py": "value = 1",
    });
    fs.mkdirSync(path.join(workspace, "pyproject.toml"));

    expect([...detectEntrypoints(["worker.py"], workspace)]).toEqual([]);
  });

  it("skips unreadable source files without losing other evidence", () => {
    const workspace = writeWorkspace({
      "worker.py": "if __name__ == '__main__':\n    pass",
    });
    fs.mkdirSync(path.join(workspace, "broken.py"));
    fs.mkdirSync(path.join(workspace, "server.py"));

    expect(
      [...detectEntrypoints(["broken.py", "server.py", "worker.py"], workspace)]
    ).toEqual(["worker.py"]);
  });
});
