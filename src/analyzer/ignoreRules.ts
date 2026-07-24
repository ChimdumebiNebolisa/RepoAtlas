import path from "path";

const IGNORED_DIR_NAMES = new Set([
  ".git",
  "node_modules",
  "vendor",
  "dist",
  ".next",
  "coverage",
  "build",
  "target",
  ".turbo",
  ".cache",
  "__pycache__",
  ".pytest_cache",
  ".gradle",
  ".idea",
  "out",
  "bin",
  "venv",
  ".venv",
]);

const BINARY_EXTENSIONS = new Set([
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".webp",
  ".ico",
  ".svg",
  ".woff",
  ".woff2",
  ".ttf",
  ".eot",
  ".mp4",
  ".mp3",
  ".zip",
  ".tar",
  ".gz",
  ".pdf",
  ".exe",
  ".dll",
  ".so",
  ".dylib",
]);

const CONTENT_IGNORED_FILENAMES = new Set([
  "package-lock.json",
  "yarn.lock",
  "pnpm-lock.yaml",
  "poetry.lock",
]);

function normalizeRepositoryPath(relPath: string): string {
  return relPath.replace(/\\/g, "/");
}

export function shouldSkipDir(dirName: string): boolean {
  return IGNORED_DIR_NAMES.has(dirName);
}

export function shouldSkipPath(relPath: string): boolean {
  const normalized = normalizeRepositoryPath(relPath);
  const parts = normalized.split("/");
  if (parts.some((p) => IGNORED_DIR_NAMES.has(p))) return true;
  const base = path.basename(normalized);
  const lowerBase = base.toLowerCase();
  const ext = path.extname(lowerBase);
  if (BINARY_EXTENSIONS.has(ext)) return true;
  if (lowerBase.endsWith(".min.js") || lowerBase.endsWith(".min.css")) return true;
  if (lowerBase.endsWith(".map")) return true;
  return false;
}

export function shouldIndexFileContent(relPath: string): boolean {
  if (shouldSkipPath(relPath)) return false;
  const base = path.basename(normalizeRepositoryPath(relPath)).toLowerCase();
  return !CONTENT_IGNORED_FILENAMES.has(base);
}
