import fs from "fs";
import path from "path";
import type { EvidenceRef, TechnicalDecision } from "@/types/report";

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

function normalizePythonPackage(value: string): string {
  return value.toLowerCase().replace(/[-_.]+/g, "-");
}

function pythonRequirementName(value: string): string | undefined {
  const match = value
    .trim()
    .match(/^([a-z0-9](?:[a-z0-9._-]*[a-z0-9])?)(?:\[[^\]]+\])?(?=\s*(?:$|[<>=!~;@]))/i);
  return match ? normalizePythonPackage(match[1]) : undefined;
}

function requirementsHasDependency(content: string, dependency: string): boolean {
  const expected = normalizePythonPackage(dependency);
  return content.split(/\r?\n/).some((line) => {
    const declaration = line.split("#", 1)[0].trim();
    return declaration.length > 0 && pythonRequirementName(declaration) === expected;
  });
}

function stripTomlComment(line: string): string {
  let quote: "'" | '"' | undefined;
  let escaped = false;

  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (quote === '"') {
      if (escaped) {
        escaped = false;
      } else if (character === "\\") {
        escaped = true;
      } else if (character === quote) {
        quote = undefined;
      }
      continue;
    }
    if (quote === "'") {
      if (character === quote) quote = undefined;
      continue;
    }
    if (character === '"' || character === "'") {
      quote = character;
    } else if (character === "#") {
      return line.slice(0, index);
    }
  }

  return line;
}

function tomlStatements(content: string): string[] {
  const statements: string[] = [];
  let pending = "";
  let arrayDepth = 0;
  let quote: "'" | '"' | undefined;
  let escaped = false;

  for (const rawLine of content.split(/\r?\n/)) {
    const line = stripTomlComment(rawLine).trim();
    if (!line && !pending) continue;
    pending = pending ? `${pending}\n${line}` : line;

    for (const character of line) {
      if (quote === '"') {
        if (escaped) {
          escaped = false;
        } else if (character === "\\") {
          escaped = true;
        } else if (character === quote) {
          quote = undefined;
        }
        continue;
      }
      if (quote === "'") {
        if (character === quote) quote = undefined;
        continue;
      }
      if (character === '"' || character === "'") {
        quote = character;
      } else if (character === "[") {
        arrayDepth += 1;
      } else if (character === "]") {
        arrayDepth -= 1;
      }
    }

    if (!quote && arrayDepth === 0) {
      statements.push(pending);
      pending = "";
    } else if (arrayDepth < 0) {
      pending = "";
      arrayDepth = 0;
      quote = undefined;
    }
  }

  return statements;
}

function parseTomlStringArray(value: string): string[] | undefined {
  const trimmed = value.trim();
  if (!trimmed.startsWith("[") || !trimmed.endsWith("]")) return undefined;

  const values: string[] = [];
  let index = 1;
  while (index < trimmed.length - 1) {
    while (/\s|,/.test(trimmed[index] ?? "")) index += 1;
    if (index >= trimmed.length - 1) break;

    const quote = trimmed[index];
    if (quote !== '"' && quote !== "'") return undefined;
    index += 1;
    let item = "";
    let closed = false;
    while (index < trimmed.length - 1) {
      const character = trimmed[index];
      if (character === quote) {
        closed = true;
        index += 1;
        break;
      }
      if (quote === '"' && character === "\\") {
        const next = trimmed[index + 1];
        if (!next) return undefined;
        item += next;
        index += 2;
        continue;
      }
      item += character;
      index += 1;
    }
    if (!closed) return undefined;
    values.push(item);

    while (/\s/.test(trimmed[index] ?? "")) index += 1;
    if (index < trimmed.length - 1 && trimmed[index] !== ",") return undefined;
  }

  return values;
}

function pyprojectHasDependency(content: string, dependency: string): boolean {
  const expected = normalizePythonPackage(dependency);
  let section = "";

  for (const statement of tomlStatements(content)) {
    const sectionMatch = statement.match(/^\[([^\[\]]+)\]$/);
    if (sectionMatch) {
      section = sectionMatch[1].trim().toLowerCase();
      continue;
    }

    const assignment = statement.match(/^([a-z0-9_.-]+)\s*=\s*([\s\S]+)$/i);
    if (!assignment) continue;
    const key = assignment[1];
    const value = assignment[2].trim();

    if (
      key.toLowerCase() === "dependencies" &&
      (section === "" || section === "project")
    ) {
      const declared = parseTomlStringArray(value);
      if (declared?.some((item) => pythonRequirementName(item) === expected)) return true;
    }

    if (section === "project.optional-dependencies") {
      const declared = parseTomlStringArray(value);
      if (declared?.some((item) => pythonRequirementName(item) === expected)) return true;
    }

    if (
      /^tool\.poetry(?:\.group\.[a-z0-9_.-]+)?\.dependencies$/i.test(section) &&
      normalizePythonPackage(key) === expected &&
      value.length > 0
    ) {
      return true;
    }
  }

  return false;
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
  return Boolean(content?.split(/\r?\n/).some((line) => /^\s*\[pytest\]\s*(?:[#;].*)?$/.test(line)));
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
