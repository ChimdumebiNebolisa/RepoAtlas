/**
 * Report JSON schema and TypeScript types for RepoAtlas.
 * See docs/spec.md Section 7 (Data Models).
 */

export interface RepoMetadata {
  name: string;
  url: string;
  branch: string;
  clone_hash: string | null;
  analyzed_at: string; // ISO 8601
}

export type FolderMapNode = {
  path: string;
  type: "file" | "dir";
  children?: FolderMapNode[];
};

export interface ArchitectureNode {
  id: string; // file path or module id
  label: string; // display name
  type?: "file" | "module" | "folder";
}

export interface ArchitectureEdge {
  from: string; // node id
  to: string; // node id
  type?: "import" | "dependency";
}

export interface Architecture {
  nodes: ArchitectureNode[];
  edges: ArchitectureEdge[];
}

export interface StartHereItem {
  path: string;
  score: number;
  explanation: string;
}

export interface DangerZoneItem {
  path: string;
  score: number;
  breakdown: string;
  metrics: {
    size?: number;
    fan_in?: number;
    fan_out?: number;
    complexity?: number;
    test_proximity?: number;
  };
}

export interface RunCommand {
  source: string; // e.g. "package.json", "README"
  command: string;
  description?: string;
}

export interface ContributeSignals {
  key_docs: string[];
  ci_configs: string[];
}

export interface Report {
  repo_metadata: RepoMetadata;
  folder_map: FolderMapNode;
  architecture: Architecture;
  start_here: StartHereItem[];
  danger_zones: DangerZoneItem[];
  run_commands: RunCommand[];
  contribute_signals: ContributeSignals;
  warnings: string[];
}
