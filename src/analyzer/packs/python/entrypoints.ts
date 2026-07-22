import fs from "fs";
import path from "path";
import { normalizeRelPath } from "./shared";

const COMMON_ENTRY_NAMES = ["main.py", "app.py", "cli.py", "server.py", "manage.py", "run.py"];
const PYPROJECT_SCRIPTS_RE = /\[project\.scripts\]\s*[\s\S]*?(\w+)\s*=\s*["']([^:]+):(\w+)["']/g;
const SETUP_ENTRY_RE = /["']console_scripts["']\s*:\s*\[[\s\S]*?["'](\w+)=([^:]+):(\w+)["']/g;

function addConfiguredEntrypoints(
  manifestPath: string,
  pattern: RegExp,
  fileByNormalized: Map<string, string>,
  entrypoints: Set<string>
): void {
  if (!fs.existsSync(manifestPath)) return;
  try {
    const content = fs.readFileSync(manifestPath, "utf-8");
    let match: RegExpExecArray | null;
    pattern.lastIndex = 0;
    while ((match = pattern.exec(content))) {
      const modulePath = (match[2] ?? "").replace(/\./g, "/") + ".py";
      const resolved = fileByNormalized.get(modulePath) ?? fileByNormalized.get("src/" + modulePath);
      if (resolved) entrypoints.add(resolved);
    }
  } catch {
    // An unreadable manifest does not stop repository analysis.
  }
}

export function detectEntrypoints(files: string[], workspacePath: string): Set<string> {
  const entrypoints = new Set<string>();
  const fileByNormalized = new Map<string, string>();
  for (const file of files) fileByNormalized.set(normalizeRelPath(file), file);

  for (const file of files) {
    const normalized = normalizeRelPath(file);
    if (/__main__\.py$/i.test(normalized)) entrypoints.add(file);
    const base = path.posix.basename(normalized);
    if (COMMON_ENTRY_NAMES.some((name) => base.toLowerCase() === name.toLowerCase())) {
      entrypoints.add(file);
    }
  }

  for (const file of files) {
    if (entrypoints.has(file)) continue;
    try {
      const content = fs.readFileSync(path.join(workspacePath, file), "utf-8");
      // Spec acceptance: treat scripts with an explicit main guard as entrypoints.
      if (/if\s+__name__\s*==\s*["']__main__["']\s*:/.test(content)) {
        entrypoints.add(file);
      }
    } catch {
      // Unreadable files are skipped for entrypoint heuristics.
    }
  }

  addConfiguredEntrypoints(
    path.join(workspacePath, "pyproject.toml"),
    PYPROJECT_SCRIPTS_RE,
    fileByNormalized,
    entrypoints
  );
  addConfiguredEntrypoints(
    path.join(workspacePath, "setup.py"),
    SETUP_ENTRY_RE,
    fileByNormalized,
    entrypoints
  );
  return entrypoints;
}

