import fs from "fs";
import path from "path";
import type { ProjectPurpose } from "@/types/report";

function firstReadme(workspacePath: string, keyDocs: string[]): string | null {
  const readme = keyDocs.find((d) => /readme/i.test(d));
  if (!readme) return null;
  const full = path.join(workspacePath, readme);
  return fs.existsSync(full) ? readme : null;
}

export function extractProjectPurpose(
  workspacePath: string,
  keyDocs: string[]
): ProjectPurpose | undefined {
  const readmeRel = firstReadme(workspacePath, keyDocs);
  if (readmeRel) {
    const content = fs.readFileSync(path.join(workspacePath, readmeRel), "utf-8");
    const heading = content.match(/^#\s+(.+)$/m);
    if (heading?.[1]) {
      return {
        text: heading[1].trim().slice(0, 500),
        source: "readme_heading",
        path: readmeRel,
        extracted: true,
        evidence_refs: [],
      };
    }
    const paragraphs = content
      .split(/\n\s*\n/)
      .map((p) => p.replace(/^#+\s*/gm, "").trim())
      .filter((p) => p.length > 20 && !p.startsWith("```"));
    if (paragraphs[0]) {
      return {
        text: paragraphs[0].slice(0, 500),
        source: "readme_intro",
        path: readmeRel,
        extracted: true,
        evidence_refs: [],
      };
    }
  }

  const pkgPath = path.join(workspacePath, "package.json");
  if (fs.existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
      if (typeof pkg.description === "string" && pkg.description.trim()) {
        return {
          text: pkg.description.trim().slice(0, 500),
          source: "package.json",
          path: "package.json",
          extracted: true,
          evidence_refs: [],
        };
      }
    } catch {
      /* ignore */
    }
  }

  const pyproject = path.join(workspacePath, "pyproject.toml");
  if (fs.existsSync(pyproject)) {
    const content = fs.readFileSync(pyproject, "utf-8");
    const desc = content.match(/description\s*=\s*"([^"]+)"/);
    if (desc?.[1]) {
      return {
        text: desc[1].slice(0, 500),
        source: "pyproject",
        path: "pyproject.toml",
        extracted: true,
        evidence_refs: [],
      };
    }
  }

  return undefined;
}
