/**
 * Deterministic TS/JS entrypoint detection from structured project metadata.
 */

import fs from "fs";
import path from "path";
import { normalizeRelPath } from "../semanticGraph";

const CODE_EXTENSIONS = [".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"];
const SCRIPT_PATH_RE =
  /(?:^|\s|["'])(\.{0,2}\/?[\w./-]+\.(?:ts|tsx|js|jsx|mjs|cjs))(?=\s|["']|$)/g;
const ENTRY_SCRIPT_NAMES = new Set(["dev", "start", "build"]);

export interface EntrypointHit {
  path: string;
  reason: string;
}

function readJson(abs: string): Record<string, unknown> | null {
  try {
    const raw = JSON.parse(fs.readFileSync(abs, "utf-8"));
    return raw && typeof raw === "object" ? (raw as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

function addIfPresent(
  out: Map<string, string>,
  fileByNormalized: Map<string, string>,
  candidate: string,
  reason: string,
  overwrite = false
): void {
  const normalized = normalizeRelPath(candidate.replace(/^\.\//, ""));
  const resolved = fileByNormalized.get(normalized);
  if (resolved && (overwrite || !out.has(resolved))) {
    out.set(resolved, reason);
  }
}

function collectExportEntryPaths(
  exportsField: unknown,
  prefix: string
): string[] {
  if (typeof exportsField === "string") {
    return exportsField.startsWith(".") ? [exportsField] : [];
  }
  if (!exportsField || typeof exportsField !== "object") return [];
  if (Array.isArray(exportsField)) {
    return exportsField.flatMap((item) => collectExportEntryPaths(item, prefix));
  }
  const record = exportsField as Record<string, unknown>;
  const out: string[] = [];
  for (const [key, value] of Object.entries(record)) {
    if (key === "import" || key === "require" || key === "default" || key === "module") {
      out.push(...collectExportEntryPaths(value, prefix));
    } else if (key.startsWith(".")) {
      out.push(...collectExportEntryPaths(value, key));
    }
  }
  return out;
}

function detectNextEntrypoints(
  files: string[],
  fileByNormalized: Map<string, string>
): Map<string, string> {
  const out = new Map<string, string>();
  for (const file of files) {
    const n = normalizeRelPath(file);
    if (
      /^((src\/)?app)\/page\.(ts|tsx|js|jsx|mjs|cjs)$/i.test(n) ||
      /^((src\/)?app)\/.*\/page\.(ts|tsx|js|jsx|mjs|cjs)$/i.test(n)
    ) {
      out.set(file, "Next.js App Router page");
    } else if (
      /^((src\/)?app)\/layout\.(ts|tsx|js|jsx|mjs|cjs)$/i.test(n) ||
      /^((src\/)?app)\/.*\/layout\.(ts|tsx|js|jsx|mjs|cjs)$/i.test(n)
    ) {
      out.set(file, "Next.js App Router layout");
    } else if (
      /^((src\/)?app)\/api\/.+\/route\.(ts|tsx|js|jsx|mjs|cjs)$/i.test(n)
    ) {
      out.set(file, "Next.js App Router route handler");
    } else if (
      /^((src\/)?middleware)\.(ts|tsx|js|jsx|mjs|cjs)$/i.test(n)
    ) {
      out.set(file, "Next.js middleware");
    } else if (
      fileByNormalized.has(n) &&
      /^((src\/)?pages)\/.+\.(ts|tsx|js|jsx)$/i.test(n) &&
      !/\._app\./i.test(n)
    ) {
      // Keep Pages Router detection narrow; _app/_document ignored as shells.
      if (!/\/(_app|_document|_error)\./i.test(n)) {
        out.set(file, "Next.js Pages Router page");
      }
    }
  }
  return out;
}

export function detectTsJsEntrypoints(
  files: string[],
  workspacePath: string,
  packageJsonRels: string[]
): { entrypoints: Map<string, string>; warnings: string[] } {
  const entrypoints = new Map<string, string>();
  const warnings: string[] = [];
  const fileByNormalized = new Map<string, string>();
  for (const file of files) {
    fileByNormalized.set(normalizeRelPath(file), file);
  }

  for (const [file, reason] of detectNextEntrypoints(files, fileByNormalized)) {
    entrypoints.set(file, reason);
  }

  for (const ext of CODE_EXTENSIONS) {
    for (const candidate of [
      `src/index${ext}`,
      `src/main${ext}`,
      `src/server${ext}`,
      `src/app${ext}`,
      `index${ext}`,
      `main${ext}`,
      `server${ext}`,
      `app${ext}`,
      `cli${ext}`,
      `src/cli${ext}`,
    ]) {
      addIfPresent(entrypoints, fileByNormalized, candidate, `common entry file ${candidate}`);
    }
  }

  for (const pkgRel of packageJsonRels) {
    const abs = path.join(workspacePath, pkgRel);
    const pkg = readJson(abs);
    if (!pkg) {
      warnings.push(`Could not parse ${normalizeRelPath(pkgRel)} for entrypoints`);
      continue;
    }

    const pkgDir = path.posix.dirname(normalizeRelPath(pkgRel));
    const withPkgDir = (candidate: string) =>
      pkgDir === "."
        ? normalizeRelPath(candidate)
        : normalizeRelPath(`${pkgDir}/${candidate}`);

    for (const field of ["main", "module", "browser", "types"] as const) {
      const value = pkg[field];
      if (typeof value === "string") {
        addIfPresent(
          entrypoints,
          fileByNormalized,
          withPkgDir(value),
          `package.json ${field}`,
          true
        );
      }
    }

    const bin = pkg.bin;
    if (typeof bin === "string") {
      addIfPresent(
        entrypoints,
        fileByNormalized,
        withPkgDir(bin),
        "package.json bin",
        true
      );
    } else if (bin && typeof bin === "object") {
      for (const [binName, binPath] of Object.entries(bin as Record<string, unknown>)) {
        if (typeof binPath === "string") {
          addIfPresent(
            entrypoints,
            fileByNormalized,
            withPkgDir(binPath),
            `package.json bin:${binName}`,
            true
          );
        }
      }
    }

    if (pkg.exports != null) {
      for (const exportPath of collectExportEntryPaths(pkg.exports, ".")) {
        addIfPresent(
          entrypoints,
          fileByNormalized,
          withPkgDir(exportPath),
          "package.json exports",
          true
        );
      }
    }

    const scripts = pkg.scripts;
    if (scripts && typeof scripts === "object") {
      for (const [name, cmdValue] of Object.entries(scripts as Record<string, unknown>)) {
        if (!ENTRY_SCRIPT_NAMES.has(name)) continue;
        if (typeof cmdValue !== "string") continue;
        let match: RegExpExecArray | null;
        SCRIPT_PATH_RE.lastIndex = 0;
        while ((match = SCRIPT_PATH_RE.exec(cmdValue))) {
          addIfPresent(
            entrypoints,
            fileByNormalized,
            withPkgDir(match[1]),
            `package.json scripts.${name}`
          );
        }
      }
    }
  }

  return { entrypoints, warnings };
}
