import fs from "fs";
import path from "path";
import type { EvidenceRef, TechnicalDecision } from "@/types/report";

export interface TechnicalDecisionDetection {
  decisions: TechnicalDecision[];
  evidence: EvidenceRef[];
}

function fileExists(workspacePath: string, rel: string): boolean {
  return fs.existsSync(path.join(workspacePath, rel));
}

function readText(workspacePath: string, rel: string): string {
  const filePath = path.join(workspacePath, rel);
  if (!fs.existsSync(filePath)) return "";
  try {
    return fs.readFileSync(filePath, "utf-8");
  } catch {
    return "";
  }
}

function readPkg(workspacePath: string): Record<string, string> {
  const content = readText(workspacePath, "package.json");
  if (!content) return {};
  try {
    const pkg = JSON.parse(content);
    return { ...pkg.dependencies, ...pkg.devDependencies };
  } catch {
    return {};
  }
}

function pythonDependencySource(workspacePath: string, dependency: string): string | undefined {
  const candidates = ["pyproject.toml", "requirements.txt", "requirements-dev.txt"];
  const dependencyPattern = new RegExp(`(^|[\\s\"'])${dependency}(?=($|[\\s\"'<>~=!]))`, "im");
  return candidates.find((candidate) => dependencyPattern.test(readText(workspacePath, candidate)));
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
    fileExists(workspacePath, candidate)
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
  if (fileExists(workspacePath, "vercel.json")) {
    addDecision("deployment", "Vercel", "vercel.json", "vercel.json");
  }
  if (fileExists(workspacePath, "Dockerfile")) {
    addDecision("deployment", "Docker", "Dockerfile", "Dockerfile");
  }
  if (deps["@vercel/blob"]) {
    addDecision("storage", "Vercel Blob storage", "package.json: @vercel/blob", "package.json");
  }

  const pytestSource = fileExists(workspacePath, "pytest.ini")
    ? "pytest.ini"
    : pythonDependencySource(workspacePath, "pytest");
  if (pytestSource) {
    addDecision("testing", "pytest", `${pytestSource}: pytest`, pytestSource);
  }

  return { decisions, evidence };
}
