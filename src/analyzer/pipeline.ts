/**
 * Common indexing pipeline for all repositories.
 * Folder tree, file metadata, language detection, key docs, CI, run commands.
 */

import fs from "fs";
import path from "path";
import type { FolderMapNode, ContributeSignals, RunCommand } from "@/types/report";
import { shouldSkipDir } from "./ignoreRules";
import { extractAllRunCommands } from "./commands";
import { MAX_DEPTH, MAX_FILE_COUNT } from "@/lib/ingestLimits";

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

/**
 * Sort key docs so root documents come before nested ones, then lexicographic.
 * Prefers meaningful root documentation over nested package docs (requirement 1)
 * and is fully deterministic (requirement 2).
 */
function sortKeyDocs(keyDocs: string[]): void {
  keyDocs.sort((a, b) => {
    const da = a.split("/").length;
    const db = b.split("/").length;
    if (da !== db) return da - db;
    return a.localeCompare(b);
  });
}

export async function runIndexingPipeline(
  workspacePath: string
): Promise<IndexingPipelineResult> {
  const file_metadata = new Map<string, FileMetadata>();
  const key_docs: string[] = [];
  const ci_configs: string[] = [];
  const warnings: string[] = [];
  let fileCount = 0;
  let depthTruncated = false;

  function buildFolderMap(dir: string, relPath: string, depth: number): FolderMapNode {
    if (depth >= MAX_DEPTH) {
      // Record that some deeply-nested entries were not walked so the truncation
      // is surfaced to the user instead of silently dropped (Phase 4).
      try {
        if (fs.readdirSync(dir).length > 0) depthTruncated = true;
      } catch {
        /* ignore unreadable directory */
      }
      return { path: relPath || ".", type: "dir", children: [], truncated: true };
    }

    const entries = fs.readdirSync(dir, { withFileTypes: true });
    const children: FolderMapNode[] = [];

    for (const ent of entries) {
      if (shouldSkipDir(ent.name)) continue;
      const fullPath = path.join(dir, ent.name);
      const childRel = (relPath ? path.join(relPath, ent.name) : ent.name).replace(
        /\\/g,
        "/"
      );

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
  if (depthTruncated) {
    warnings.push(
      `Folder map truncated at depth ${MAX_DEPTH}; deeper directories were not walked.`
    );
  }

  // Deterministic ordering so downstream extraction, evidence and reports do not
  // depend on filesystem traversal order (Phase 3 requirement 2 / Phase 4).
  sortKeyDocs(key_docs);
  ci_configs.sort((a, b) => a.localeCompare(b));

  const { commands: run_commands, warnings: runWarnings } =
    extractAllRunCommands(workspacePath, key_docs);
  warnings.push(...runWarnings);

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
