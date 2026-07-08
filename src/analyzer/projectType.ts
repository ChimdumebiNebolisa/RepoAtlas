import fs from "fs";
import path from "path";
import type { ProjectProfile } from "@/types/report";

function hasFile(files: Set<string>, pattern: RegExp): boolean {
  return Array.from(files).some((f) => pattern.test(f.replace(/\\/g, "/")));
}

function readPackageJson(workspacePath: string): Record<string, unknown> | null {
  const p = path.join(workspacePath, "package.json");
  if (!fs.existsSync(p)) return null;
  try {
    return JSON.parse(fs.readFileSync(p, "utf-8"));
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
    const pyproject = fs.readFileSync(path.join(workspacePath, "pyproject.toml"), "utf-8");
    if (/fastapi/i.test(pyproject)) {
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
  } else if (hasFile(files, /\.java$/) && hasFile(files, /@SpringBootApplication/)) {
    type = "spring-boot";
    label = "Spring Boot application";
    signals.push("Java + Spring Boot signals");
    confidence = "medium";
  } else if (hasFile(files, /pom\.xml$/) || hasFile(files, /build\.gradle/)) {
    type = "java-maven-gradle";
    label = "Java Maven/Gradle project";
    signals.push("pom.xml or build.gradle");
    confidence = "medium";
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
