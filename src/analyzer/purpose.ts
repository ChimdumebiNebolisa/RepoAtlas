import fs from "fs";
import path from "path";
import type { ProjectPurpose } from "@/types/report";

export interface ExtractPurposeOptions {
  /** Canonical README path chosen by documentation discovery (root preferred). */
  canonicalReadme?: string;
  /** Repository name, used to reject headings that are only the repo name. */
  repoName?: string;
}

interface WorkspaceText {
  content: string;
  relativePath: string;
}

function isInsideWorkspace(workspaceRoot: string, candidatePath: string): boolean {
  const relative = path.relative(workspaceRoot, candidatePath);
  return (
    relative !== "" &&
    relative !== ".." &&
    !relative.startsWith(`..${path.sep}`) &&
    !path.isAbsolute(relative)
  );
}

function safeWorkspaceFile(
  workspacePath: string,
  candidatePath: string
): { fullPath: string; relativePath: string } | null {
  const normalized = candidatePath.replace(/\\/g, "/");
  if (
    !normalized ||
    path.posix.isAbsolute(normalized) ||
    /^[a-zA-Z]:\//.test(normalized) ||
    path.posix.normalize(normalized) !== normalized
  ) {
    return null;
  }

  try {
    const workspaceRoot = fs.realpathSync(workspacePath);
    const fullPath = path.resolve(workspaceRoot, normalized);
    if (!isInsideWorkspace(workspaceRoot, fullPath)) return null;

    const relative = path.relative(workspaceRoot, fullPath);
    let current = workspaceRoot;
    const segments = relative.split(path.sep);
    for (const [index, segment] of segments.entries()) {
      current = path.join(current, segment);
      const stat = fs.lstatSync(current);
      if (stat.isSymbolicLink()) return null;
      const isFile = index === segments.length - 1;
      if (isFile ? !stat.isFile() : !stat.isDirectory()) return null;
    }

    return { fullPath, relativePath: normalized };
  } catch {
    return null;
  }
}

function readWorkspaceText(
  workspacePath: string,
  candidatePath: string
): WorkspaceText | null {
  const safePath = safeWorkspaceFile(workspacePath, candidatePath);
  if (!safePath) return null;

  try {
    return {
      content: fs.readFileSync(
        /* turbopackIgnore: true */ safePath.fullPath,
        "utf-8"
      ),
      relativePath: safePath.relativePath,
    };
  } catch {
    return null;
  }
}

function readmeCandidates(
  keyDocs: string[],
  canonicalReadme?: string
): string[] {
  const candidates = [
    ...(canonicalReadme ? [canonicalReadme] : []),
    ...keyDocs.filter((candidate) =>
      /(^|[\\/])readme(\.[^./\\]+)?$/i.test(candidate)
    ),
  ];
  const seen = new Set<string>();
  return candidates.filter((candidate) => {
    const normalized = candidate.replace(/\\/g, "/");
    if (seen.has(normalized)) return false;
    seen.add(normalized);
    return true;
  });
}

/** Loose normalization for comparing a heading against the repo name. */
function normalizeName(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

/** True when a README heading carries no meaning beyond the repo name. */
function isRepoNameOnlyHeading(heading: string, repoName?: string): boolean {
  const normalizedHeading = normalizeName(heading);
  if (!normalizedHeading) return true;
  if (!repoName) return false;
  const normalizedRepo = normalizeName(repoName);
  // Repo name may be "owner/name" for GitHub inputs; compare against the tail too.
  const repoTail = normalizeName(repoName.split("/").pop() ?? repoName);
  return normalizedHeading === normalizedRepo || normalizedHeading === repoTail;
}

function meaningfulParagraph(content: string): string | null {
  const paragraphs = content
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.replace(/^#+\s*/gm, "").trim())
    .filter(
      (paragraph) => paragraph.length > 20 && !paragraph.startsWith("```")
    );
  return paragraphs[0] ?? null;
}

function purposeFromReadme(
  readme: WorkspaceText,
  repoName?: string
): ProjectPurpose | null {
  const heading = readme.content.match(/^#\s+(.+)$/m);
  const headingText = heading?.[1]?.trim();

  if (headingText && !isRepoNameOnlyHeading(headingText, repoName)) {
    return {
      text: headingText.slice(0, 500),
      source: "readme_heading",
      path: readme.relativePath,
      extracted: true,
      evidence_refs: [],
    };
  }

  const paragraph = meaningfulParagraph(readme.content);
  if (!paragraph) return null;
  return {
    text: paragraph.slice(0, 500),
    source: "readme_intro",
    path: readme.relativePath,
    extracted: true,
    evidence_refs: [],
  };
}

function parseTomlString(value: string): string | null {
  const doubleQuoted = value.match(
    /^("(?:[^"\\]|\\.)*")\s*(?:#.*)?$/
  );
  if (doubleQuoted?.[1]) {
    try {
      const parsed = JSON.parse(doubleQuoted[1]);
      return typeof parsed === "string" && parsed.trim() ? parsed.trim() : null;
    } catch {
      return null;
    }
  }

  const singleQuoted = value.match(/^'([^']*)'\s*(?:#.*)?$/);
  const parsed = singleQuoted?.[1]?.trim();
  return parsed || null;
}

function pythonDescription(content: string): string | null {
  const descriptions: Partial<Record<"project" | "tool.poetry", string>> = {};
  let section = "";

  for (const line of content.split(/\r?\n/)) {
    const sectionMatch = line.match(/^\s*\[([^\]]+)\]\s*(?:#.*)?$/);
    if (sectionMatch?.[1]) {
      section = sectionMatch[1].trim();
      continue;
    }
    if (section !== "project" && section !== "tool.poetry") continue;

    const descriptionMatch = line.match(/^\s*description\s*=\s*(.+)$/);
    if (!descriptionMatch?.[1] || descriptions[section]) continue;
    const description = parseTomlString(descriptionMatch[1]);
    if (description) descriptions[section] = description;
  }

  return descriptions.project ?? descriptions["tool.poetry"] ?? null;
}

export function extractProjectPurpose(
  workspacePath: string,
  keyDocs: string[],
  options: ExtractPurposeOptions = {}
): ProjectPurpose | undefined {
  for (const candidate of readmeCandidates(
    keyDocs,
    options.canonicalReadme
  )) {
    const readme = readWorkspaceText(workspacePath, candidate);
    if (!readme) continue;
    const purpose = purposeFromReadme(readme, options.repoName);
    if (purpose) return purpose;
  }

  const packageJson = readWorkspaceText(workspacePath, "package.json");
  if (packageJson) {
    try {
      const pkg: unknown = JSON.parse(packageJson.content);
      if (
        pkg &&
        typeof pkg === "object" &&
        !Array.isArray(pkg) &&
        "description" in pkg &&
        typeof pkg.description === "string" &&
        pkg.description.trim()
      ) {
        return {
          text: pkg.description.trim().slice(0, 500),
          source: "package.json",
          path: packageJson.relativePath,
          extracted: true,
          evidence_refs: [],
        };
      }
    } catch {
      /* malformed package metadata is not purpose evidence */
    }
  }

  const pyproject = readWorkspaceText(workspacePath, "pyproject.toml");
  if (pyproject) {
    const description = pythonDescription(pyproject.content);
    if (description) {
      return {
        text: description.slice(0, 500),
        source: "pyproject",
        path: pyproject.relativePath,
        extracted: true,
        evidence_refs: [],
      };
    }
  }

  return undefined;
}
