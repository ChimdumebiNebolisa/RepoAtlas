import fs from "fs";
import path from "path";
import type { RunCommand } from "@/types/report";

function safeFilePath(workspacePath: string, relativePath: string): string | null {
  try {
    const workspaceRoot = fs.realpathSync(workspacePath);
    const candidate = path.resolve(workspaceRoot, relativePath);
    const relative = path.relative(workspaceRoot, candidate);
    if (
      relative === ".." ||
      relative.startsWith(`..${path.sep}`) ||
      path.isAbsolute(relative)
    ) {
      return null;
    }

    let current = workspaceRoot;
    const parts = relative.split(path.sep).filter(Boolean);
    for (const [index, part] of parts.entries()) {
      current = path.join(current, part);
      const stat = fs.lstatSync(current);
      if (stat.isSymbolicLink()) return null;
      if (index < parts.length - 1 && !stat.isDirectory()) return null;
      if (index === parts.length - 1 && !stat.isFile()) return null;
    }
    return parts.length > 0 ? candidate : null;
  } catch {
    return null;
  }
}

function readText(workspacePath: string, relativePath: string): string | null {
  const filePath = safeFilePath(workspacePath, relativePath);
  if (!filePath) return null;
  try {
    return fs.readFileSync(filePath, "utf-8");
  } catch {
    return null;
  }
}

function hasSafeFile(workspacePath: string, relativePath: string): boolean {
  return safeFilePath(workspacePath, relativePath) !== null;
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
  if (!hasSafeFile(workspacePath, "package.json")) return [];
  try {
    const pkg = JSON.parse(readText(workspacePath, "package.json") ?? "{}");
    const scripts = pkg.scripts;
    if (!scripts || typeof scripts !== "object" || Array.isArray(scripts)) return [];
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
  const makefile = ["Makefile", "makefile", "GNUmakefile"].find((file) =>
    hasSafeFile(workspacePath, file)
  );
  if (!makefile) return [];
  const content = readText(workspacePath, makefile);
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
  if (hasSafeFile(workspacePath, "pyproject.toml")) {
    const content = readText(workspacePath, "pyproject.toml") ?? "";
    const scriptMatches = content.matchAll(
      /\[(?:project|tool\.poetry)\.scripts\][^\S\r\n]*\r?\n([\s\S]*?)(?=\r?\n\[|$)/g
    );
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
  if (hasSafeFile(workspacePath, "Pipfile")) {
    commands.push({ source: "Pipfile", command: "pipenv install", description: "install" });
    commands.push({ source: "Pipfile", command: "pipenv run pytest", description: "test" });
  }
  if (hasSafeFile(workspacePath, "requirements.txt")) {
    commands.push({
      source: "requirements.txt",
      command: "pip install -r requirements.txt",
      description: "install",
    });
  }
  if (hasSafeFile(workspacePath, "manage.py")) {
    commands.push({ source: "django", command: "python manage.py runserver", description: "runserver" });
  }
  return commands;
}

export function extractJavaCommands(workspacePath: string): RunCommand[] {
  const commands: RunCommand[] = [];
  if (hasSafeFile(workspacePath, "pom.xml")) {
    commands.push({ source: "pom.xml", command: "mvn test", description: "test" });
    commands.push({ source: "pom.xml", command: "mvn package", description: "package" });
  }
  if (
    hasSafeFile(workspacePath, "build.gradle") ||
    hasSafeFile(workspacePath, "build.gradle.kts")
  ) {
    commands.push({ source: "build.gradle", command: "./gradlew test", description: "test" });
    commands.push({ source: "build.gradle", command: "./gradlew build", description: "build" });
  }
  return commands;
}

export function extractDockerCommands(workspacePath: string): RunCommand[] {
  const files = ["docker-compose.yml", "docker-compose.yaml", "compose.yml", "compose.yaml"];
  const found = files.find((file) => hasSafeFile(workspacePath, file));
  if (!found) return [];
  return [
    { source: "docker-compose", command: "docker compose up", description: "up" },
    { source: "docker-compose", command: "docker compose up --build", description: "build and up" },
  ];
}

export function extractReadmeCommands(workspacePath: string, keyDocs: string[]): RunCommand[] {
  const commands: RunCommand[] = [];
  const readme = keyDocs.find((d) => /readme/i.test(d)) ?? "README.md";
  if (!hasSafeFile(workspacePath, readme)) return [];
  const content = readText(workspacePath, readme) ?? "";
  const fenceRe = /```(?:bash|sh|shell)?[ \t]*\r?\n([\s\S]*?)```/gi;
  let match;
  while ((match = fenceRe.exec(content)) !== null) {
    for (const line of match[1].split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      if (/^(npm|yarn|pnpm|make|python|pip|pipenv|poetry|docker|mvn|gradle|\.\/gradlew|pytest)/i.test(trimmed)) {
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
