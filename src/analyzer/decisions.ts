import fs from "fs";
import path from "path";
import type { EvidenceRef, TechnicalDecision } from "@/types/report";
import {
  pyprojectHasDependency,
  pytestIniDeclaresPytest,
  requirementsHasDependency,
} from "./dependencyEvidence";

export interface TechnicalDecisionDetection {
  decisions: TechnicalDecision[];
  evidence: EvidenceRef[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function safeWorkspaceFile(workspacePath: string, rel: string): string | undefined {
  if (!rel || path.isAbsolute(rel)) return undefined;

  try {
    const workspaceRoot = fs.realpathSync(workspacePath);
    const normalized = path.normalize(rel);
    if (normalized === ".." || normalized.startsWith(`..${path.sep}`)) return undefined;

    const candidate = path.resolve(workspaceRoot, normalized);
    const relative = path.relative(workspaceRoot, candidate);
    if (!relative || relative === ".." || relative.startsWith(`..${path.sep}`)) return undefined;

    let current = workspaceRoot;
    for (const segment of relative.split(path.sep)) {
      current = path.join(current, segment);
      const stats = fs.lstatSync(current);
      if (stats.isSymbolicLink()) return undefined;
    }

    return fs.statSync(candidate).isFile() ? candidate : undefined;
  } catch {
    return undefined;
  }
}

function readText(workspacePath: string, rel: string): string | undefined {
  const filePath = safeWorkspaceFile(workspacePath, rel);
  if (!filePath) return undefined;
  try {
    return fs.readFileSync(filePath, "utf-8");
  } catch {
    return undefined;
  }
}

function dependencyMap(value: unknown): Record<string, string> {
  if (!isRecord(value)) return {};
  return Object.fromEntries(
    Object.entries(value).filter((entry): entry is [string, string] => typeof entry[1] === "string")
  );
}

function readPkg(workspacePath: string): Record<string, string> {
  const content = readText(workspacePath, "package.json");
  if (!content) return {};
  try {
    const pkg: unknown = JSON.parse(content);
    if (!isRecord(pkg)) return {};
    return {
      ...dependencyMap(pkg.dependencies),
      ...dependencyMap(pkg.devDependencies),
    };
  } catch {
    return {};
  }
}

function pythonDependencySource(workspacePath: string, dependency: string): string | undefined {
  const candidates = ["pyproject.toml", "requirements.txt", "requirements-dev.txt"];
  return candidates.find((candidate) => {
    const content = readText(workspacePath, candidate);
    if (!content) return false;
    return candidate === "pyproject.toml"
      ? pyprojectHasDependency(content, dependency)
      : requirementsHasDependency(content, dependency);
  });
}

function hasTailwindConfig(workspacePath: string, rel: string): boolean {
  const content = readText(workspacePath, rel);
  if (!content) return false;
  const withoutComments = content.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  return /^\s*(?:export\s+default\b|module\.exports\s*=)/m.test(withoutComments);
}

function hasVercelConfig(workspacePath: string): boolean {
  const content = readText(workspacePath, "vercel.json");
  if (!content) return false;
  try {
    return isRecord(JSON.parse(content));
  } catch {
    return false;
  }
}

function hasDockerfile(workspacePath: string): boolean {
  const content = readText(workspacePath, "Dockerfile");
  return Boolean(
    content
      ?.split(/\r?\n/)
      .some((line) => /^\s*FROM(?:\s+--platform=\S+)?\s+\S+/i.test(line.replace(/#.*$/, "")))
  );
}

function hasPytestConfig(workspacePath: string): boolean {
  const content = readText(workspacePath, "pytest.ini");
  return content ? pytestIniDeclaresPytest(content) : false;
}

export function detectTechnicalDecisions(workspacePath: string): TechnicalDecisionDetection {
  const decisions: TechnicalDecision[] = [];
  const evidence: EvidenceRef[] = [];
  const evidenceByPath = new Map<string, string>();
  const deps = readPkg(workspacePath);

  function evidenceRef(sourcePath: string): string {
    const existing = evidenceByPath.get(sourcePath);
    if (existing) return existing;

    const id = `decision-${evidence.length + 1}`;
    evidenceByPath.set(sourcePath, id);
    evidence.push({
      id,
      kind: "decision",
      label: `Technical decision source: ${sourcePath}`,
      path: sourcePath,
      detail: "Manifest or configuration file used for deterministic technical-decision detection.",
    });
    return id;
  }

  function addDecision(
    category: TechnicalDecision["category"],
    decision: string,
    signal: string,
    sourcePath: string
  ) {
    decisions.push({
      category,
      decision,
      signals: [signal],
      evidence_refs: [evidenceRef(sourcePath)],
    });
  }

  if (deps.next) {
    addDecision("framework", "Next.js", "package.json: next", "package.json");
  } else if (deps.react) {
    addDecision("framework", "React", "package.json: react", "package.json");
  }

  const djangoSource = pythonDependencySource(workspacePath, "django");
  if (djangoSource) {
    addDecision("framework", "Django", `${djangoSource}: django`, djangoSource);
  }

  const tailwindConfig = ["tailwind.config.ts", "tailwind.config.js"].find((candidate) =>
    hasTailwindConfig(workspacePath, candidate)
  );
  if (deps.tailwindcss) {
    addDecision("styling", "Tailwind CSS", "package.json: tailwindcss", "package.json");
  } else if (tailwindConfig) {
    addDecision("styling", "Tailwind CSS", tailwindConfig, tailwindConfig);
  }

  if (deps.vitest || deps.jest) {
    const framework = deps.vitest ? "Vitest" : "Jest";
    const packageName = deps.vitest ? "vitest" : "jest";
    addDecision("testing", framework, `package.json: ${packageName}`, "package.json");
  }
  if (deps.prisma || deps["@prisma/client"]) {
    addDecision("database", "Prisma", "package.json: prisma", "package.json");
  }
  if (deps["next-auth"] || deps["@auth/core"]) {
    addDecision("auth", "NextAuth / Auth.js", "package.json: auth dependency", "package.json");
  }
  if (hasVercelConfig(workspacePath)) {
    addDecision("deployment", "Vercel", "vercel.json", "vercel.json");
  }
  if (hasDockerfile(workspacePath)) {
    addDecision("deployment", "Docker", "Dockerfile", "Dockerfile");
  }
  if (deps["@vercel/blob"]) {
    addDecision("storage", "Vercel Blob storage", "package.json: @vercel/blob", "package.json");
  }

  const pytestSource = hasPytestConfig(workspacePath)
    ? "pytest.ini"
    : pythonDependencySource(workspacePath, "pytest");
  if (pytestSource) {
    addDecision("testing", "pytest", `${pytestSource}: pytest`, pytestSource);
  }

  return { decisions, evidence };
}
