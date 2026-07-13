/**
 * Language-neutral semantic dependency graph.
 * Source of truth for TS/JS coupling signals; architecture UI graph is derived.
 */

export const SEMANTIC_GRAPH_VERSION = 1;

export type SemanticNodeKind =
  | "file"
  | "package"
  | "module"
  | "declaration"
  | "entrypoint";

export type SemanticEdgeKind =
  | "import"
  | "dynamic_import"
  | "require"
  | "re_export"
  | "package_dependency";

export type ResolutionStatus =
  | "resolved_internal"
  | "resolved_external"
  | "unresolved"
  | "ignored";

export interface SemanticEvidence {
  path: string;
  line_start: number;
  line_end: number;
  snippet?: string;
}

export interface SemanticNode {
  id: string;
  kind: SemanticNodeKind;
  /** Workspace-relative path for file nodes; package name for package nodes. */
  label: string;
  language?: string;
  /** Why an entrypoint was classified as one. */
  entrypoint_reason?: string;
}

export interface SemanticEdge {
  id: string;
  from: string;
  to?: string;
  specifier: string;
  kind: SemanticEdgeKind;
  resolution: ResolutionStatus;
  evidence: SemanticEvidence;
  reason?: string;
  /** True for `import type` / `export type`. */
  type_only?: boolean;
}

export interface SemanticGraphStats {
  node_count: number;
  edge_count: number;
  resolved_internal: number;
  resolved_external: number;
  unresolved: number;
  ignored: number;
  entrypoint_count: number;
}

export interface SemanticGraph {
  version: typeof SEMANTIC_GRAPH_VERSION;
  language: string;
  adapter: string;
  nodes: SemanticNode[];
  edges: SemanticEdge[];
  stats: SemanticGraphStats;
  warnings: string[];
}
