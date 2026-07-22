import fs from "fs";
import os from "os";
import path from "path";
import { afterEach, describe, expect, it } from "vitest";
import {
  extractAllRunCommands,
  extractDockerCommands,
  extractJavaCommands,
  extractMakefileCommands,
  extractPackageJsonCommands,
  extractPythonCommands,
  extractReadmeCommands,
} from "./index";

const workspaces: string[] = [];

function createWorkspace(files: Record<string, string> = {}): string {
  const workspace = fs.mkdtempSync(path.join(os.tmpdir(), "repoatlas-commands-"));
  workspaces.push(workspace);
  for (const [relativePath, content] of Object.entries(files)) {
    const filePath = path.join(workspace, relativePath);
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, content);
  }
  return workspace;
}

afterEach(() => {
  for (const workspace of workspaces.splice(0)) {
    fs.rmSync(workspace, { recursive: true, force: true });
  }
});

describe("package.json command extraction", () => {
  it("extracts only string-valued scripts in manifest order", () => {
    const workspace = createWorkspace({
      "package.json": JSON.stringify({
        scripts: { dev: "next dev", invalid: false, test: "vitest", missing: null },
      }),
    });

    expect(extractPackageJsonCommands(workspace)).toEqual([
      { source: "package.json", command: "npm run dev", description: "dev" },
      { source: "package.json", command: "npm run test", description: "test" },
    ]);
  });

  it.each(["not json", JSON.stringify({ scripts: "npm test" }), JSON.stringify({ scripts: [] })])(
    "does not invent commands for invalid script metadata: %s",
    (packageJson) => {
      const workspace = createWorkspace({ "package.json": packageJson });
      expect(extractPackageJsonCommands(workspace)).toEqual([]);
    }
  );

  it("returns no commands when the manifest is absent or unreadable", () => {
    expect(extractPackageJsonCommands(createWorkspace())).toEqual([]);
    const workspace = createWorkspace();
    fs.mkdirSync(path.join(workspace, "package.json"));
    expect(extractPackageJsonCommands(workspace)).toEqual([]);
  });
});

describe("Makefile command extraction", () => {
  it.each(["Makefile", "makefile", "GNUmakefile"])("extracts supported targets from %s", (name) => {
    const workspace = createWorkspace({
      [name]: ".PHONY: test\ninstall:\n\ttrue\ntest :\n\ttrue\ndev:\n\ttrue\nbuild:\n\ttrue\nlint:\n\ttrue\nstart:\n\ttrue\nrun:\n\ttrue\nignored:\n\ttrue\n",
    });

    expect(extractMakefileCommands(workspace).map((item) => item.command)).toEqual([
      "make test",
      "make run",
      "make dev",
      "make build",
      "make lint",
      "make start",
      "make install",
    ]);
  });

  it("returns no commands when a Makefile is absent or unreadable", () => {
    expect(extractMakefileCommands(createWorkspace())).toEqual([]);
    const workspace = createWorkspace();
    fs.mkdirSync(path.join(workspace, "Makefile"));
    expect(extractMakefileCommands(workspace)).toEqual([]);
  });
});

describe("Python command extraction", () => {
  it("extracts PEP 621 and Poetry scripts plus Poetry setup commands", () => {
    const workspace = createWorkspace({
      "pyproject.toml": [
        "[project.scripts]",
        'repoatlas = "app:main"',
        'invalid.script = "app:invalid"',
        "[tool.poetry.scripts]",
        'worker = "app:worker"',
        "[tool.poetry.dependencies]",
        'python = "^3.12"',
      ].join("\n"),
    });

    expect(extractPythonCommands(workspace)).toEqual([
      { source: "pyproject.toml", command: "repoatlas", description: "script: repoatlas" },
      { source: "pyproject.toml", command: "worker", description: "script: worker" },
      { source: "pyproject.toml", command: "poetry install", description: "install" },
      { source: "pyproject.toml", command: "poetry run pytest", description: "test" },
    ]);
  });

  it("extracts Pipfile, requirements, and Django commands", () => {
    const workspace = createWorkspace({
      Pipfile: "[packages]\n",
      "requirements.txt": "pytest\n",
      "manage.py": "",
    });

    expect(extractPythonCommands(workspace)).toEqual([
      { source: "Pipfile", command: "pipenv install", description: "install" },
      { source: "Pipfile", command: "pipenv run pytest", description: "test" },
      {
        source: "requirements.txt",
        command: "pip install -r requirements.txt",
        description: "install",
      },
      { source: "django", command: "python manage.py runserver", description: "runserver" },
    ]);
  });

  it("ignores an unreadable pyproject", () => {
    const workspace = createWorkspace();
    fs.mkdirSync(path.join(workspace, "pyproject.toml"));
    expect(extractPythonCommands(workspace)).toEqual([]);
  });
});

describe("Java and Compose command extraction", () => {
  it("extracts Maven and Gradle commands together", () => {
    const workspace = createWorkspace({ "pom.xml": "", "build.gradle.kts": "" });
    expect(extractJavaCommands(workspace).map((item) => item.command)).toEqual([
      "mvn test",
      "mvn package",
      "./gradlew test",
      "./gradlew build",
    ]);
  });

  it("returns no Java commands without a recognized build file", () => {
    expect(extractJavaCommands(createWorkspace())).toEqual([]);
  });

  it.each(["docker-compose.yml", "docker-compose.yaml", "compose.yml", "compose.yaml"])(
    "extracts Compose commands from %s",
    (name) => {
      const workspace = createWorkspace({ [name]: "services: {}\n" });
      expect(extractDockerCommands(workspace).map((item) => item.command)).toEqual([
        "docker compose up",
        "docker compose up --build",
      ]);
    }
  );

  it("returns no Compose commands without a recognized file", () => {
    expect(extractDockerCommands(createWorkspace())).toEqual([]);
  });
});

describe("README command extraction", () => {
  it("extracts commands only from shell fences in the selected README", () => {
    const workspace = createWorkspace({
      "docs/README-setup.md": [
        "```bash",
        "# setup",
        "npm install",
        "pnpm test",
        "```",
        "```sh",
        "pipenv install",
        "poetry run pytest",
        "```",
        "```shell",
        "./gradlew build",
        "docker compose up",
        "```",
        "```",
        "make test",
        "python manage.py runserver",
        "mvn package",
        "gradle test",
        "pytest",
        "```",
        "```javascript",
        'npm run false-positive',
        "```",
        "```text",
        "yarn false-positive",
        "```",
      ].join("\n"),
    });

    expect(
      extractReadmeCommands(workspace, ["docs/README-setup.md"]).map((item) => item.command)
    ).toEqual([
      "npm install",
      "pnpm test",
      "pipenv install",
      "poetry run pytest",
      "./gradlew build",
      "docker compose up",
      "make test",
      "python manage.py runserver",
      "mvn package",
      "gradle test",
      "pytest",
    ]);
  });

  it("uses the root README fallback and ignores comments, blanks, and prose", () => {
    const workspace = createWorkspace({
      "README.md": "```bash\n\n# note\necho prose\nnpm test\n```\n",
    });
    expect(extractReadmeCommands(workspace, []).map((item) => item.command)).toEqual(["npm test"]);
  });

  it("returns no commands when the README is absent or unreadable", () => {
    expect(extractReadmeCommands(createWorkspace(), [])).toEqual([]);
    const workspace = createWorkspace();
    fs.mkdirSync(path.join(workspace, "README.md"));
    expect(extractReadmeCommands(workspace, [])).toEqual([]);
  });
});

describe("combined command extraction", () => {
  it("preserves source priority while deduplicating command casing and whitespace", () => {
    const workspace = createWorkspace({
      "package.json": JSON.stringify({ scripts: { test: "vitest" } }),
      "README.md": "```bash\nNPM RUN TEST\n npm run lint \n```\n",
    });

    expect(extractAllRunCommands(workspace, []).commands).toEqual([
      { source: "package.json", command: "npm run test", description: "test" },
      { source: "README", command: "npm run lint", description: "from readme" },
    ]);
    expect(extractAllRunCommands(workspace, []).warnings).toEqual([]);
  });

  it("returns the bounded warning when no commands are detected", () => {
    expect(extractAllRunCommands(createWorkspace(), [])).toEqual({
      commands: [],
      warnings: ["No run commands detected from package.json, Makefile, or docs."],
    });
  });
});
