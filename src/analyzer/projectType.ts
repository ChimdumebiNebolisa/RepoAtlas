import fs from "fs";
import path from "path";
import type { ProjectProfile } from "@/types/report";

function hasFile(files: Set<string>, pattern: RegExp): boolean {
  return Array.from(files).some((f) => pattern.test(f.replace(/\\/g, "/")));
}

function isInsideWorkspace(workspacePath: string, candidatePath: string): boolean {
  const relative = path.relative(workspacePath, candidatePath);
  return relative === "" || (!relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative));
}

function readWorkspaceFile(workspacePath: string, filePath: string): string | null {
  const normalized = filePath.replace(/\\/g, "/");
  if (path.isAbsolute(normalized) || /^[a-zA-Z]:\//.test(normalized)) return null;

  try {
    const workspaceRoot = fs.realpathSync(workspacePath);
    const candidate = path.resolve(workspaceRoot, normalized);
    if (!isInsideWorkspace(workspaceRoot, candidate)) return null;

    const realCandidate = fs.realpathSync(candidate);
    if (!isInsideWorkspace(workspaceRoot, realCandidate)) return null;
    return fs.readFileSync(realCandidate, "utf-8");
  } catch {
    return null;
  }
}

function findFile(files: Set<string>, pattern: RegExp): string | undefined {
  return Array.from(files)
    .filter((file) => pattern.test(file))
    .sort((left, right) => {
      const depthDifference = left.split("/").length - right.split("/").length;
      return depthDifference || left.localeCompare(right);
    })[0];
}

function readPackageJson(workspacePath: string): Record<string, unknown> | null {
  const content = readWorkspaceFile(workspacePath, "package.json");
  if (content === null) return null;
  try {
    return JSON.parse(content);
  } catch {
    return null;
  }
}

export function detectProjectProfile(
  workspacePath: string,
  filePaths: Iterable<string>
): ProjectProfile | undefined {
  const files = new Set(Array.from(filePaths).map((f) => f.replace(/\\/g, "/")));
  const pkg = readPackageJson(workspacePath);
  const deps = {
    ...(pkg?.dependencies as Record<string, string> | undefined),
    ...(pkg?.devDependencies as Record<string, string> | undefined),
  };
  const signals: string[] = [];
  let type = "unknown";
  let label = "Unknown project type";
  let confidence: ProjectProfile["confidence"] = "low";

  if (hasFile(files, /(^|\/)manage\.py$/)) {
    type = "django";
    label = "Django application";
    signals.push("manage.py");
    confidence = "high";
  } else if (hasFile(files, /(^|\/)src\/app\/.*page\.(tsx|jsx)$/)) {
    type = "nextjs-app";
    label = "Next.js application";
    signals.push("src/app/**/page.tsx");
    confidence = "high";
  } else if (deps?.next) {
    type = "nextjs-app";
    label = "Next.js application";
    signals.push("next dependency");
    confidence = "medium";
  } else if (hasFile(files, /(^|\/)pyproject\.toml$/) && hasFile(files, /\.py$/)) {
    const pyprojectPath = findFile(files, /(^|\/)pyproject\.toml$/);
    const pyproject = pyprojectPath
      ? readWorkspaceFile(workspacePath, pyprojectPath)
      : null;
    if (pyproject && /fastapi/i.test(pyproject)) {
      type = "fastapi";
      label = "FastAPI application";
      signals.push("fastapi in pyproject.toml");
      confidence = "high";
    } else {
      type = "python-cli";
      label = "Python project";
      signals.push("pyproject.toml");
      confidence = "medium";
    }
  } else if (hasFile(files, /\.java$/)) {
    for (const file of files) {
      if (!file.endsWith(".java")) continue;
      const content = readWorkspaceFile(workspacePath, file);
      if (content && /@SpringBootApplication/.test(content)) {
        type = "spring-boot";
        label = "Spring Boot application";
        signals.push(`${file} (@SpringBootApplication)`);
        confidence = "high";
        break;
      }
    }
    if (type === "unknown" && (hasFile(files, /pom\.xml$/) || hasFile(files, /build\.gradle/))) {
      type = "java-maven-gradle";
      label = "Java Maven/Gradle project";
      signals.push("pom.xml or build.gradle");
      confidence = "medium";
    }
  } else if (deps?.express || deps?.fastify || hasFile(files, /routes?\//)) {
    type = "node-api";
    label = "Node API";
    signals.push("express/fastify or routes/");
    confidence = "medium";
  } else if (deps?.react && !deps?.next) {
    type = "react-spa";
    label = "React SPA";
    signals.push("react without next");
    confidence = "medium";
  } else if (!hasFile(files, /\.(ts|js|py|java)$/)) {
    type = "docs-only";
    label = "Docs-only repository";
    signals.push("no supported source files");
    confidence = "high";
  } else if (pkg?.main || pkg?.bin) {
    type = "library";
    label = "Library or package";
    signals.push("package.json main/bin");
    confidence = "medium";
  }

  if (type === "unknown") return undefined;

  return {
    type,
    label,
    confidence,
    signals,
    evidence_refs: [],
  };
}
