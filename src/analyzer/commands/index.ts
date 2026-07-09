import fs from "fs";
import path from "path";
import type { RunCommand } from "@/types/report";

function readText(filePath: string): string | null {
  try {
    return fs.readFileSync(filePath, "utf-8");
  } catch {
    return null;
  }
}

function dedupeCommands(commands: RunCommand[]): RunCommand[] {
  const seen = new Set<string>();
  const out: RunCommand[] = [];
  for (const cmd of commands) {
    const key = cmd.command.trim().toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(cmd);
  }
  return out;
}

export function extractPackageJsonCommands(workspacePath: string): RunCommand[] {
  const pkgPath = path.join(workspacePath, "package.json");
  if (!fs.existsSync(pkgPath)) return [];
  try {
    const pkg = JSON.parse(readText(pkgPath) ?? "{}");
    const scripts = pkg.scripts ?? {};
    return Object.entries(scripts)
      .filter(([, v]) => typeof v === "string")
      .map(([name]) => ({
        source: "package.json",
        command: `npm run ${name}`,
        description: name,
      }));
  } catch {
    return [];
  }
}

export function extractMakefileCommands(workspacePath: string): RunCommand[] {
  const makefile = ["Makefile", "makefile", "GNUmakefile"].find((f) =>
    fs.existsSync(path.join(workspacePath, f))
  );
  if (!makefile) return [];
  const content = readText(path.join(workspacePath, makefile));
  if (!content) return [];
  const targets = ["test", "run", "dev", "build", "lint", "start", "install"];
  const commands: RunCommand[] = [];
  for (const target of targets) {
    if (new RegExp(`^${target}\\s*:`, "m").test(content)) {
      commands.push({
        source: "Makefile",
        command: `make ${target}`,
        description: target,
      });
    }
  }
  return commands;
}

export function extractPythonCommands(workspacePath: string): RunCommand[] {
  const commands: RunCommand[] = [];
  const pyproject = path.join(workspacePath, "pyproject.toml");
  if (fs.existsSync(pyproject)) {
    const content = readText(pyproject) ?? "";
    const scriptMatches = content.matchAll(/\[project\.scripts\]\s*([\s\S]*?)(?:\n\[|$)/g);
    for (const match of scriptMatches) {
      const block = match[1];
      for (const line of block.split("\n")) {
        const m = line.match(/^([a-zA-Z0-9_-]+)\s*=/);
        if (m) {
          commands.push({
            source: "pyproject.toml",
            command: m[1],
            description: `script: ${m[1]}`,
          });
        }
      }
    }
    if (content.includes("[tool.poetry.scripts]")) {
      commands.push({ source: "pyproject.toml", command: "poetry install", description: "install" });
      commands.push({ source: "pyproject.toml", command: "poetry run pytest", description: "test" });
    }
  }
  const pipfile = path.join(workspacePath, "Pipfile");
  if (fs.existsSync(pipfile)) {
    commands.push({ source: "Pipfile", command: "pipenv install", description: "install" });
    commands.push({ source: "Pipfile", command: "pipenv run pytest", description: "test" });
  }
  if (fs.existsSync(path.join(workspacePath, "requirements.txt"))) {
    commands.push({
      source: "requirements.txt",
      command: "pip install -r requirements.txt",
      description: "install",
    });
  }
  if (fs.existsSync(path.join(workspacePath, "manage.py"))) {
    commands.push({ source: "django", command: "python manage.py runserver", description: "runserver" });
  }
  return commands;
}

export function extractJavaCommands(workspacePath: string): RunCommand[] {
  const commands: RunCommand[] = [];
  if (fs.existsSync(path.join(workspacePath, "pom.xml"))) {
    commands.push({ source: "pom.xml", command: "mvn test", description: "test" });
    commands.push({ source: "pom.xml", command: "mvn package", description: "package" });
  }
  if (
    fs.existsSync(path.join(workspacePath, "build.gradle")) ||
    fs.existsSync(path.join(workspacePath, "build.gradle.kts"))
  ) {
    commands.push({ source: "build.gradle", command: "./gradlew test", description: "test" });
    commands.push({ source: "build.gradle", command: "./gradlew build", description: "build" });
  }
  return commands;
}

export function extractDockerCommands(workspacePath: string): RunCommand[] {
  const files = ["docker-compose.yml", "docker-compose.yaml", "compose.yml"];
  const found = files.find((f) => fs.existsSync(path.join(workspacePath, f)));
  if (!found) return [];
  return [
    { source: "docker-compose", command: "docker compose up", description: "up" },
    { source: "docker-compose", command: "docker compose up --build", description: "build and up" },
  ];
}

export function extractReadmeCommands(workspacePath: string, keyDocs: string[]): RunCommand[] {
  const commands: RunCommand[] = [];
  const readme = keyDocs.find((d) => /readme/i.test(d)) ?? "README.md";
  const readmePath = path.join(workspacePath, readme);
  if (!fs.existsSync(readmePath)) return [];
  const content = readText(readmePath) ?? "";
  const fenceRe = /```(?:bash|sh|shell)?\s*([\s\S]*?)```/gi;
  let match;
  while ((match = fenceRe.exec(content)) !== null) {
    for (const line of match[1].split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      if (/^(npm|yarn|pnpm|make|python|pip|docker|mvn|gradle|pytest)/i.test(trimmed)) {
        commands.push({ source: "README", command: trimmed, description: "from readme" });
      }
    }
  }
  return commands;
}

export function extractAllRunCommands(
  workspacePath: string,
  keyDocs: string[]
): { commands: RunCommand[]; warnings: string[] } {
  const warnings: string[] = [];
  const priority = [
    ...extractPackageJsonCommands(workspacePath),
    ...extractMakefileCommands(workspacePath),
    ...extractPythonCommands(workspacePath),
    ...extractJavaCommands(workspacePath),
    ...extractDockerCommands(workspacePath),
    ...extractReadmeCommands(workspacePath, keyDocs),
  ];
  if (priority.length === 0) {
    warnings.push("No run commands detected from package.json, Makefile, or docs.");
  }
  return { commands: dedupeCommands(priority), warnings };
}
