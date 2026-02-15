/**
 * Common indexing pipeline for all repositories.
 * Folder tree, file metadata, language detection, key docs, CI, run commands.
 */

import fs from "fs";
import path from "path";
import type { FolderMapNode, RunCommand, ContributeSignals } from "@/types/report";

const MAX_DEPTH = 10;
const MAX_FILE_COUNT = 10_000;

export interface IndexingPipelineResult {
  folder_map: FolderMapNode;
  run_commands: RunCommand[];
  contribute_signals: ContributeSignals;
  file_metadata: Map<string, FileMetadata>;
  key_docs: string[];
  ci_configs: string[];
  warnings: string[];
}

export interface FileMetadata {
  path: string;
  size: number;
  extension: string;
  language: string;
}

const EXT_TO_LANG: Record<string, string> = {
  ".ts": "typescript",
  ".tsx": "typescript",
  ".js": "javascript",
  ".jsx": "javascript",
  ".mjs": "javascript",
  ".cjs": "javascript",
  ".py": "python",
  ".java": "java",
  ".md": "markdown",
  ".json": "json",
  ".yml": "yaml",
  ".yaml": "yaml",
};

const KEY_DOC_PATTERNS = [
  /^README(\.[^.]+)?$/i,
  /^CONTRIBUTING(\.[^.]+)?$/i,
  /^LICENSE(\.[^.]+)?$/i,
  /^CHANGELOG(\.[^.]+)?$/i,
];

const CI_PATTERNS = [
  ".github/workflows",
  ".gitlab-ci.yml",
  "Jenkinsfile",
  "azure-pipelines.yml",
];

export async function runIndexingPipeline(
  workspacePath: string
): Promise<IndexingPipelineResult> {
  const file_metadata = new Map<string, FileMetadata>();
  const key_docs: string[] = [];
  const ci_configs: string[] = [];
  const warnings: string[] = [];
  let fileCount = 0;

  function buildFolderMap(dir: string, relPath: string, depth: number): FolderMapNode {
    if (depth >= MAX_DEPTH) {
      return { path: relPath || ".", type: "dir", children: [] };
    }

    const entries = fs.readdirSync(dir, { withFileTypes: true });
    const children: FolderMapNode[] = [];

    for (const ent of entries) {
      if (ent.name === ".git" || ent.name === "node_modules") continue;
      const fullPath = path.join(dir, ent.name);
      const childRel = relPath ? path.join(relPath, ent.name) : ent.name;

      if (ent.isDirectory()) {
        children.push(buildFolderMap(fullPath, childRel, depth + 1));
      } else {
        if (fileCount < MAX_FILE_COUNT) {
          const stat = fs.statSync(fullPath);
          const ext = path.extname(ent.name);
          const lang = EXT_TO_LANG[ext] ?? "unknown";
          file_metadata.set(childRel, {
            path: childRel,
            size: stat.size,
            extension: ext,
            language: lang,
          });
          fileCount++;
        }
        children.push({ path: childRel, type: "file" });

        const name = ent.name;
        if (KEY_DOC_PATTERNS.some((p) => p.test(name))) {
          key_docs.push(childRel);
        }
        if (CI_PATTERNS.some((p) => childRel.includes(p) || childRel.endsWith(p))) {
          ci_configs.push(childRel);
        }
      }
    }

    return {
      path: relPath || ".",
      type: "dir",
      children: children.sort((a, b) => {
        if (a.type !== b.type) return a.type === "dir" ? -1 : 1;
        return a.path.localeCompare(b.path);
      }),
    };
  }

  const folder_map = buildFolderMap(workspacePath, ".", 0);

  if (fileCount >= MAX_FILE_COUNT) {
    warnings.push("Max file count reached; some files omitted");
  }

  const run_commands = await extractRunCommands(workspacePath);

  const contribute_signals: ContributeSignals = {
    key_docs,
    ci_configs,
  };

  return {
    folder_map,
    run_commands,
    contribute_signals,
    file_metadata,
    key_docs,
    ci_configs,
    warnings,
  };
}

async function extractRunCommands(workspacePath: string): Promise<RunCommand[]> {
  const commands: RunCommand[] = [];
  const pkgPath = path.join(workspacePath, "package.json");

  if (fs.existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
      const scripts = pkg.scripts ?? {};
      for (const [name, cmd] of Object.entries(scripts)) {
        if (typeof cmd === "string") {
          commands.push({
            source: "package.json",
            command: `npm run ${name}`,
            description: name,
          });
        }
      }
    } catch {
      // ignore parse errors
    }
  }

  return commands;
}
