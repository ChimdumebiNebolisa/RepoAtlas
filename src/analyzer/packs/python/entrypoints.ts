import fs from "fs";
import path from "path";
import { normalizeRelPath } from "./shared";
import { stripPythonCommentsAndStrings } from "./signals";

const COMMON_ENTRY_NAMES = ["main.py", "app.py", "cli.py", "server.py", "run.py"];
const DJANGO_MANAGEMENT_CALL_RE = /\bexecute_from_command_line\s*\(/;
const PYPROJECT_SCRIPTS_HEADER_RE = /^\s*\[project\.scripts\]\s*$/m;
const PYPROJECT_SCRIPT_RE =
  /^\s*[\w.-]+\s*=\s*["']([A-Za-z_]\w*(?:\.[A-Za-z_]\w*)*):[A-Za-z_]\w*(?:\.[A-Za-z_]\w*)*["']/gm;
const SETUP_CONSOLE_SCRIPTS_RE = /["']console_scripts["']\s*:\s*\[([\s\S]*?)\]/g;
const SETUP_SCRIPT_RE =
  /["'][^"'=]+?\s*=\s*([A-Za-z_]\w*(?:\.[A-Za-z_]\w*)*)\s*:[A-Za-z_]\w*(?:\.[A-Za-z_]\w*)*["']/g;

function pyprojectScriptModules(content: string): string[] {
  const header = PYPROJECT_SCRIPTS_HEADER_RE.exec(content);
  if (!header) return [];
  const remainder = content.slice(header.index + header[0].length);
  const nextSection = /^\s*\[/m.exec(remainder);
  const section = nextSection ? remainder.slice(0, nextSection.index) : remainder;
  return Array.from(section.matchAll(PYPROJECT_SCRIPT_RE), (match) => match[1]);
}

function setupScriptModules(content: string): string[] {
  const modules: string[] = [];
  SETUP_CONSOLE_SCRIPTS_RE.lastIndex = 0;
  let section: RegExpExecArray | null;
  while ((section = SETUP_CONSOLE_SCRIPTS_RE.exec(content))) {
    const entries = section[1] ?? "";
    SETUP_SCRIPT_RE.lastIndex = 0;
    for (const match of entries.matchAll(SETUP_SCRIPT_RE)) {
      modules.push(match[1]);
    }
  }
  return modules;
}

function addConfiguredEntrypoints(
  manifestPath: string,
  findModules: (content: string) => string[],
  fileByNormalized: Map<string, string>,
  entrypoints: Set<string>
): void {
  if (!fs.existsSync(manifestPath)) return;
  try {
    const content = fs.readFileSync(manifestPath, "utf-8");
    for (const moduleName of findModules(content)) {
      const modulePath = moduleName.replace(/\./g, "/") + ".py";
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
    if (base.toLowerCase() === "manage.py") {
      try {
        const content = fs.readFileSync(path.join(workspacePath, file), "utf-8");
        if (DJANGO_MANAGEMENT_CALL_RE.test(stripPythonCommentsAndStrings(content))) {
          entrypoints.add(file);
        }
      } catch {
        // An unreadable manage.py has no executable evidence.
      }
      continue;
    }
    if (COMMON_ENTRY_NAMES.some((name) => base.toLowerCase() === name.toLowerCase())) {
      try {
        const content = fs.readFileSync(path.join(workspacePath, file), "utf-8");
        if (stripPythonCommentsAndStrings(content).trim()) {
          entrypoints.add(file);
        }
      } catch {
        // An unreadable conventional file has no executable evidence.
      }
    }
  }

  for (const file of files) {
    if (entrypoints.has(file)) continue;
    try {
      const content = fs.readFileSync(path.join(workspacePath, file), "utf-8");
      // Strip comments/strings enough to avoid treating docs/examples as entrypoints.
      const scrubbed = content
        .replace(/'''[\s\S]*?'''|"""[\s\S]*?"""/g, '""')
        .replace(/#[^\n]*/g, "");
      if (/^\s*if\s+__name__\s*==\s*["']__main__["']\s*:/m.test(scrubbed)) {
        entrypoints.add(file);
      }
    } catch {
      // Unreadable files are skipped for entrypoint heuristics.
    }
  }

  addConfiguredEntrypoints(
    path.join(workspacePath, "pyproject.toml"),
    pyprojectScriptModules,
    fileByNormalized,
    entrypoints
  );
  addConfiguredEntrypoints(
    path.join(workspacePath, "setup.py"),
    setupScriptModules,
    fileByNormalized,
    entrypoints
  );
  return entrypoints;
}
