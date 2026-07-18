import fs from "fs";
import path from "path";
import type { ProjectPurpose } from "@/types/report";

export interface ExtractPurposeOptions {
  /** Canonical README path chosen by documentation discovery (root preferred). */
  canonicalReadme?: string;
  /** Repository name, used to reject headings that are only the repo name. */
  repoName?: string;
}

function firstReadme(
  workspacePath: string,
  keyDocs: string[],
  canonicalReadme?: string
): string | null {
  if (
    canonicalReadme &&
    fs.existsSync(
      /* turbopackIgnore: true */ path.join(
        /* turbopackIgnore: true */ workspacePath,
        canonicalReadme
      )
    )
  ) {
    return canonicalReadme;
  }
  const readme = keyDocs.find((d) => /(^|\/)readme(\.[^./]+)?$/i.test(d));
  if (!readme) return null;
  const full = path.join(/* turbopackIgnore: true */ workspacePath, readme);
  return fs.existsSync(/* turbopackIgnore: true */ full) ? readme : null;
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
    .map((p) => p.replace(/^#+\s*/gm, "").trim())
    .filter((p) => p.length > 20 && !p.startsWith("```"));
  return paragraphs[0] ?? null;
}

export function extractProjectPurpose(
  workspacePath: string,
  keyDocs: string[],
  options: ExtractPurposeOptions = {}
): ProjectPurpose | undefined {
  const readmeRel = firstReadme(workspacePath, keyDocs, options.canonicalReadme);
  if (readmeRel) {
    const content = fs.readFileSync(
      /* turbopackIgnore: true */ path.join(
        /* turbopackIgnore: true */ workspacePath,
        readmeRel
      ),
      "utf-8"
    );
    const heading = content.match(/^#\s+(.+)$/m);
    const headingText = heading?.[1]?.trim();

    // A heading that is only the repo name is not a real purpose (requirement 10):
    // prefer a meaningful introductory paragraph instead.
    if (headingText && !isRepoNameOnlyHeading(headingText, options.repoName)) {
      return {
        text: headingText.slice(0, 500),
        source: "readme_heading",
        path: readmeRel,
        extracted: true,
        evidence_refs: [],
      };
    }

    const paragraph = meaningfulParagraph(content);
    if (paragraph) {
      return {
        text: paragraph.slice(0, 500),
        source: "readme_intro",
        path: readmeRel,
        extracted: true,
        evidence_refs: [],
      };
    }

    // Fall back to the bare heading only if nothing better exists.
    if (headingText) {
      return {
        text: headingText.slice(0, 500),
        source: "readme_heading",
        path: readmeRel,
        extracted: true,
        evidence_refs: [],
      };
    }
  }

  const pkgPath = path.join(
    /* turbopackIgnore: true */ workspacePath,
    "package.json"
  );
  if (fs.existsSync(/* turbopackIgnore: true */ pkgPath)) {
    try {
      const pkg = JSON.parse(
        fs.readFileSync(/* turbopackIgnore: true */ pkgPath, "utf-8")
      );
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

  const pyproject = path.join(
    /* turbopackIgnore: true */ workspacePath,
    "pyproject.toml"
  );
  if (fs.existsSync(/* turbopackIgnore: true */ pyproject)) {
    const content = fs.readFileSync(
      /* turbopackIgnore: true */ pyproject,
      "utf-8"
    );
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
