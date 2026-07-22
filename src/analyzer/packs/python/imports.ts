import fs from "fs";
import path from "path";
import { normalizeRelPath } from "./shared";
import { extractImportSpecifiers as scanImportSpecifiers } from "./extract";

/** Extract module specs from Python source (absolute and relative). */
export function extractImportSpecifiers(content: string): string[] {
  return scanImportSpecifiers(content);
}

function containsPackageInit(dir: string): boolean {
  try {
    const entries = fs.readdirSync(dir);
    if (entries.includes("__init__.py")) return true;
    return entries.some((entry) => {
      const fullPath = path.join(dir, entry);
      return fs.statSync(fullPath).isDirectory() && containsPackageInit(fullPath);
    });
  } catch {
    return false;
  }
}

/** Detect package roots (for example, src/ or the repository root). */
export function detectPackageRoots(workspacePath: string): string[] {
  const roots: string[] = [];
  const pyprojectPath = path.join(workspacePath, "pyproject.toml");
  if (fs.existsSync(pyprojectPath)) {
    try {
      const content = fs.readFileSync(pyprojectPath, "utf-8");
      if (
        /package-dir|packages\s*=\s*find_packages\s*\(\s*["']src["']\s*\)|\[tool\.setuptools\.packages\.find\]/.test(
          content
        )
      ) {
        roots.push("src/");
      }
    } catch {
      // A package manifest that cannot be read does not stop repository analysis.
    }
  }

  const setupPath = path.join(workspacePath, "setup.py");
  if (fs.existsSync(setupPath)) {
    try {
      const content = fs.readFileSync(setupPath, "utf-8");
      if (
        /package_dir\s*=\s*\{[^}]*["']:["']\s*src\s*["']\s*\}/.test(content) ||
        /find_packages\s*\(\s*["']src["']\s*\)/.test(content)
      ) {
        if (!roots.includes("src/")) roots.push("src/");
      }
    } catch {
      // A setup file that cannot be read does not stop repository analysis.
    }
  }

  const srcPath = path.join(workspacePath, "src");
  if (fs.existsSync(srcPath) && fs.statSync(srcPath).isDirectory()) {
    if (containsPackageInit(srcPath) && !roots.includes("src/")) roots.push("src/");
  }

  roots.push("");
  return roots;
}

function resolveModulePath(
  baseDir: string,
  modulePath: string,
  workspacePath: string
): string | null {
  if (!modulePath) return null;
  const normalized = normalizeRelPath(baseDir);
  const relativePath = modulePath.split(".").join("/");

  const asFile = path.join(workspacePath, normalized, relativePath + ".py");
  if (fs.existsSync(asFile)) return normalizeRelPath(path.relative(workspacePath, asFile));

  const asPackage = path.join(workspacePath, normalized, relativePath, "__init__.py");
  if (fs.existsSync(asPackage)) {
    return normalizeRelPath(path.relative(workspacePath, asPackage));
  }

  return null;
}

/** Resolve an import to a repository-relative file, or null when it is external. */
export function resolveImport(
  fromFile: string,
  importPath: string,
  workspacePath: string,
  packageRoots: string[],
  fileSet: Set<string>
): string | null {
  const fromDir = path.dirname(normalizeRelPath(fromFile));

  if (importPath.startsWith(".")) {
    const dotCount = importPath.match(/^\.+/)?.[0]?.length ?? 0;
    const rest = importPath.slice(dotCount).replace(/^\.+/, "");
    const up = dotCount === 1 ? fromDir : path.join(fromDir, ...Array(dotCount - 1).fill(".."));
    const baseDir = path.normalize(up).replace(/\\/g, "/");
    const resolved = resolveModulePath(baseDir, rest || "", workspacePath);
    if (resolved && fileSet.has(resolved)) return resolved;
    if (resolved) return resolved;
    if (!rest) {
      const initPath = path.normalize(path.join(up, "__init__.py")).replace(/\\/g, "/");
      if (fileSet.has(initPath)) return initPath;
    }
    return null;
  }

  for (const root of packageRoots) {
    const baseDir = root === "" ? "." : root.replace(/\/$/, "");
    const resolved = resolveModulePath(baseDir, importPath, workspacePath);
    if (resolved && fileSet.has(resolved)) return resolved;
  }

  return null;
}
