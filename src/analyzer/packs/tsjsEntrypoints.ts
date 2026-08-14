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
const TEST_PATH_RE = /(?:^|\/)(?:__tests__\/.*|[^/]+\.(?:test|spec))\.(?:ts|tsx|js|jsx|mjs|cjs)$/i;

export interface EntrypointHit {
  path: string;
  reason: string;
}

interface PackageManifest {
  dir: string;
  value: Record<string, unknown>;
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
  if (TEST_PATH_RE.test(normalized)) return;
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

function appRouterReason(file: string): string | null {
  if (
    /^((src\/)?app)\/page\.(ts|tsx|js|jsx|mjs|cjs)$/i.test(file) ||
    /^((src\/)?app)\/.*\/page\.(ts|tsx|js|jsx|mjs|cjs)$/i.test(file)
  ) {
    return "Next.js App Router page";
  }
  if (
    /^((src\/)?app)\/layout\.(ts|tsx|js|jsx|mjs|cjs)$/i.test(file) ||
    /^((src\/)?app)\/.*\/layout\.(ts|tsx|js|jsx|mjs|cjs)$/i.test(file)
  ) {
    return "Next.js App Router layout";
  }
  if (/^((src\/)?app)\/(?:.+\/)?route\.(ts|tsx|js|jsx|mjs|cjs)$/i.test(file)) {
    return "Next.js App Router route handler";
  }
  return null;
}

function declaresNextJs(pkg: Record<string, unknown>): boolean {
  return ["dependencies", "devDependencies", "peerDependencies", "optionalDependencies"].some(
    (field) => {
      const dependencies = pkg[field];
      if (!dependencies || typeof dependencies !== "object" || Array.isArray(dependencies)) {
        return false;
      }
      const version = (dependencies as Record<string, unknown>).next;
      return typeof version === "string" && version.trim().length > 0;
    }
  );
}

function nearestNestedManifest(
  file: string,
  manifests: PackageManifest[]
): PackageManifest | undefined {
  return manifests
    .filter(({ dir }) => dir !== "." && file.startsWith(`${dir}/`))
    .sort((a, b) => b.dir.length - a.dir.length)[0];
}

function detectNextEntrypoints(
  files: string[],
  manifests: PackageManifest[]
): Map<string, string> {
  const out = new Map<string, string>();
  for (const file of files) {
    const n = normalizeRelPath(file);
    if (TEST_PATH_RE.test(n)) continue;
    const rootAppRouterReason = appRouterReason(n);
    if (rootAppRouterReason) {
      out.set(file, rootAppRouterReason);
    } else if (
      /^((src\/)?middleware)\.(ts|tsx|js|jsx|mjs|cjs)$/i.test(n)
    ) {
      out.set(file, "Next.js middleware");
    } else if (
      /^((src\/)?pages)\/.+\.(ts|tsx|js|jsx)$/i.test(n) &&
      !/\._app\./i.test(n)
    ) {
      // Keep Pages Router detection narrow; _app/_document ignored as shells.
      if (!/\/(_app|_document|_error)\./i.test(n)) {
        out.set(file, "Next.js Pages Router page");
      }
    } else {
      const manifest = nearestNestedManifest(n, manifests);
      if (!manifest || !declaresNextJs(manifest.value)) continue;
      const packageRelative = n.slice(manifest.dir.length + 1);
      const nestedAppRouterReason = appRouterReason(packageRelative);
      if (nestedAppRouterReason) out.set(file, nestedAppRouterReason);
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

  const manifests: PackageManifest[] = [];
  for (const pkgRel of packageJsonRels) {
    const pkg = readJson(path.join(workspacePath, pkgRel));
    if (!pkg) {
      warnings.push(`Could not parse ${normalizeRelPath(pkgRel)} for entrypoints`);
      continue;
    }
    manifests.push({
      dir: path.posix.dirname(normalizeRelPath(pkgRel)),
      value: pkg,
    });
  }

  for (const [file, reason] of detectNextEntrypoints(files, manifests)) {
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

  for (const { dir: pkgDir, value: pkg } of manifests) {
    const withPkgDir = (candidate: string) => {
      const packageRelative = normalizeRelPath(candidate);
      return pkgDir === "."
        ? packageRelative
        : normalizeRelPath(`${pkgDir}/${packageRelative}`);
    };

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
