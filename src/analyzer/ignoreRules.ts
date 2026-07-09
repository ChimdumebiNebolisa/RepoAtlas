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

export function shouldSkipDir(dirName: string): boolean {
  return IGNORED_DIR_NAMES.has(dirName);
}

export function shouldSkipPath(relPath: string): boolean {
  const normalized = relPath.replace(/\\/g, "/");
  const parts = normalized.split("/");
  if (parts.some((p) => IGNORED_DIR_NAMES.has(p))) return true;
  const base = path.basename(normalized);
  const ext = path.extname(base).toLowerCase();
  if (BINARY_EXTENSIONS.has(ext)) return true;
  if (base.endsWith(".min.js") || base.endsWith(".min.css")) return true;
  if (base.endsWith(".map") && !base.endsWith(".ts.map")) return true;
  return false;
}

export function shouldIndexFileContent(relPath: string): boolean {
  if (shouldSkipPath(relPath)) return false;
  const base = path.basename(relPath);
  if (/^(package-lock|yarn\.lock|pnpm-lock|poetry\.lock)/i.test(base)) return false;
  return true;
}
