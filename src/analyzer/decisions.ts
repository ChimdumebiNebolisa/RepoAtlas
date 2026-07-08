import fs from "fs";
import path from "path";
import type { TechnicalDecision } from "@/types/report";

function fileExists(workspacePath: string, rel: string): boolean {
  return fs.existsSync(path.join(workspacePath, rel));
}

function readPkg(workspacePath: string): Record<string, string> {
  const p = path.join(workspacePath, "package.json");
  if (!fs.existsSync(p)) return {};
  try {
    const pkg = JSON.parse(fs.readFileSync(p, "utf-8"));
    return { ...pkg.dependencies, ...pkg.devDependencies };
  } catch {
    return {};
  }
}

export function detectTechnicalDecisions(workspacePath: string): TechnicalDecision[] {
  const decisions: TechnicalDecision[] = [];
  const deps = readPkg(workspacePath);

  if (deps.next) {
    decisions.push({
      category: "framework",
      decision: "Next.js",
      signals: ["package.json: next"],
      evidence_refs: [],
    });
  } else if (deps.react) {
    decisions.push({
      category: "framework",
      decision: "React",
      signals: ["package.json: react"],
      evidence_refs: [],
    });
  }
  if (deps.django) {
    decisions.push({
      category: "framework",
      decision: "Django",
      signals: ["package.json/pyproject: django"],
      evidence_refs: [],
    });
  }
  if (deps.tailwindcss || fileExists(workspacePath, "tailwind.config.ts") || fileExists(workspacePath, "tailwind.config.js")) {
    decisions.push({
      category: "styling",
      decision: "Tailwind CSS",
      signals: ["tailwind dependency or config"],
      evidence_refs: [],
    });
  }
  if (deps.vitest || deps.jest) {
    decisions.push({
      category: "testing",
      decision: deps.vitest ? "Vitest" : "Jest",
      signals: [`package.json: ${deps.vitest ? "vitest" : "jest"}`],
      evidence_refs: [],
    });
  }
  if (deps.prisma || deps["@prisma/client"]) {
    decisions.push({
      category: "database",
      decision: "Prisma",
      signals: ["prisma dependency"],
      evidence_refs: [],
    });
  }
  if (deps["next-auth"] || deps["@auth/core"]) {
    decisions.push({
      category: "auth",
      decision: "NextAuth / Auth.js",
      signals: ["next-auth dependency"],
      evidence_refs: [],
    });
  }
  if (fileExists(workspacePath, "vercel.json")) {
    decisions.push({
      category: "deployment",
      decision: "Vercel",
      signals: ["vercel.json"],
      evidence_refs: [],
    });
  }
  if (fileExists(workspacePath, "Dockerfile")) {
    decisions.push({
      category: "deployment",
      decision: "Docker",
      signals: ["Dockerfile"],
      evidence_refs: [],
    });
  }
  if (deps["@vercel/blob"]) {
    decisions.push({
      category: "storage",
      decision: "Vercel Blob storage",
      signals: ["@vercel/blob dependency"],
      evidence_refs: [],
    });
  }
  if (fileExists(workspacePath, "pytest.ini") || fileExists(workspacePath, "pyproject.toml")) {
    const py = fileExists(workspacePath, "pyproject.toml")
      ? fs.readFileSync(path.join(workspacePath, "pyproject.toml"), "utf-8")
      : "";
    if (/pytest/i.test(py)) {
      decisions.push({
        category: "testing",
        decision: "pytest",
        signals: ["pytest in pyproject"],
        evidence_refs: [],
      });
    }
  }

  return decisions;
}
