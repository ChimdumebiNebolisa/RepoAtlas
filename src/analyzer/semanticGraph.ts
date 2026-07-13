/**
 * Deterministic helpers for semantic graphs and derived architecture views.
 */

import type { Architecture } from "@/types/report";
import type {
  SemanticEdge,
  SemanticGraph,
  SemanticGraphStats,
  SemanticNode,
} from "@/types/semanticGraph";
import { SEMANTIC_GRAPH_VERSION } from "@/types/semanticGraph";

const ARCH_NODE_CAP = 50;
const ARCH_EDGE_CAP = 200;
const SNIPPET_MAX = 120;

export function normalizeRelPath(relPath: string): string {
  return relPath.replace(/\\/g, "/").replace(/^\.\//, "");
}

export function fileNodeId(relPath: string): string {
  return `file:${normalizeRelPath(relPath)}`;
}

export function packageNodeId(name: string): string {
  return `package:${name}`;
}

export function edgeId(parts: {
  from: string;
  kind: string;
  specifier: string;
  line: number;
  to?: string;
}): string {
  return [
    parts.from,
    parts.kind,
    parts.specifier,
    String(parts.line),
    parts.to ?? "",
  ].join("|");
}

export function boundSnippet(text: string): string {
  const compact = text.replace(/\s+/g, " ").trim();
  if (compact.length <= SNIPPET_MAX) return compact;
  return `${compact.slice(0, SNIPPET_MAX - 1)}…`;
}

export function computeSemanticStats(
  nodes: SemanticNode[],
  edges: SemanticEdge[]
): SemanticGraphStats {
  let resolved_internal = 0;
  let resolved_external = 0;
  let unresolved = 0;
  let ignored = 0;
  for (const edge of edges) {
    switch (edge.resolution) {
      case "resolved_internal":
        resolved_internal += 1;
        break;
      case "resolved_external":
        resolved_external += 1;
        break;
      case "unresolved":
        unresolved += 1;
        break;
      case "ignored":
        ignored += 1;
        break;
    }
  }
  return {
    node_count: nodes.length,
    edge_count: edges.length,
    resolved_internal,
    resolved_external,
    unresolved,
    ignored,
    entrypoint_count: nodes.filter((n) => n.kind === "entrypoint").length,
  };
}

/** Sort nodes and edges for byte-stable serialization. */
export function finalizeSemanticGraph(input: {
  language: string;
  adapter: string;
  nodes: SemanticNode[];
  edges: SemanticEdge[];
  warnings?: string[];
}): SemanticGraph {
  const nodes = [...input.nodes].sort((a, b) => a.id.localeCompare(b.id));
  const edges = [...input.edges].sort((a, b) => {
    const idCmp = a.id.localeCompare(b.id);
    if (idCmp !== 0) return idCmp;
    return a.from.localeCompare(b.from);
  });
  const warnings = [...(input.warnings ?? [])].sort((a, b) => a.localeCompare(b));
  return {
    version: SEMANTIC_GRAPH_VERSION,
    language: input.language,
    adapter: input.adapter,
    nodes,
    edges,
    stats: computeSemanticStats(nodes, edges),
    warnings,
  };
}

function toFolderPath(filePath: string): string {
  const normalized = normalizeRelPath(filePath);
  const idx = normalized.lastIndexOf("/");
  return idx === -1 ? "." : normalized.slice(0, idx);
}

/**
 * Derive the reduced folder-level architecture graph from internal semantic edges.
 * Unresolved and external edges do not contribute to coupling architecture.
 */
export function deriveArchitectureFromSemantic(
  files: string[],
  graph: SemanticGraph
): { architecture: Architecture; warnings: string[] } {
  const warnings: string[] = [];
  const folderFileCounts = new Map<string, number>();

  for (const file of files) {
    const folder = toFolderPath(file);
    folderFileCounts.set(folder, (folderFileCounts.get(folder) ?? 0) + 1);
  }

  const edgeWeights = new Map<string, number>();
  for (const edge of graph.edges) {
    if (edge.resolution !== "resolved_internal" || !edge.to) continue;
    if (!edge.from.startsWith("file:") || !edge.to.startsWith("file:")) continue;
    const fromFile = edge.from.slice("file:".length);
    const toFile = edge.to.slice("file:".length);
    const fromFolder = toFolderPath(fromFile);
    const toFolder = toFolderPath(toFile);
    const key = `${fromFolder}=>${toFolder}`;
    edgeWeights.set(key, (edgeWeights.get(key) ?? 0) + 1);
  }

  const folderDegree = new Map<string, number>();
  for (const [edgeKey, weight] of edgeWeights) {
    const [from, to] = edgeKey.split("=>");
    folderDegree.set(from, (folderDegree.get(from) ?? 0) + weight);
    folderDegree.set(to, (folderDegree.get(to) ?? 0) + weight);
  }
  for (const folder of folderFileCounts.keys()) {
    if (!folderDegree.has(folder)) folderDegree.set(folder, 0);
  }

  const sortedFolders = Array.from(folderFileCounts.keys()).sort((a, b) => {
    const degreeDelta = (folderDegree.get(b) ?? 0) - (folderDegree.get(a) ?? 0);
    if (degreeDelta !== 0) return degreeDelta;
    const fileCountDelta =
      (folderFileCounts.get(b) ?? 0) - (folderFileCounts.get(a) ?? 0);
    if (fileCountDelta !== 0) return fileCountDelta;
    return a.localeCompare(b);
  });

  const selectedFolders = sortedFolders.slice(0, ARCH_NODE_CAP);
  if (sortedFolders.length > ARCH_NODE_CAP) {
    warnings.push(
      `Architecture nodes capped at ${ARCH_NODE_CAP} folders (from ${sortedFolders.length}).`
    );
  }
  if (files.length > selectedFolders.length) {
    warnings.push(
      `Architecture reduced from file-level (${files.length} files) to folder-level (${selectedFolders.length} folders).`
    );
  }

  const selectedFolderSet = new Set(selectedFolders);
  const edges = Array.from(edgeWeights.entries())
    .map(([edgeKey, weight]) => {
      const [from, to] = edgeKey.split("=>");
      return { from, to, weight };
    })
    .filter(
      (edge) => selectedFolderSet.has(edge.from) && selectedFolderSet.has(edge.to)
    )
    .sort((a, b) => {
      const weightDelta = b.weight - a.weight;
      if (weightDelta !== 0) return weightDelta;
      const fromDelta = a.from.localeCompare(b.from);
      if (fromDelta !== 0) return fromDelta;
      return a.to.localeCompare(b.to);
    })
    .slice(0, ARCH_EDGE_CAP)
    .map(({ from, to }) => ({ from, to, type: "import" as const }));

  const fullEdgeCount = Array.from(edgeWeights.keys()).filter((edgeKey) => {
    const [from, to] = edgeKey.split("=>");
    return selectedFolderSet.has(from) && selectedFolderSet.has(to);
  }).length;
  if (fullEdgeCount > ARCH_EDGE_CAP) {
    warnings.push(
      `Architecture edges capped at ${ARCH_EDGE_CAP} links (from ${fullEdgeCount}).`
    );
  }

  const nodes = selectedFolders.map((folder) => ({
    id: folder,
    label: folder === "." ? "." : folder,
    type: "folder" as const,
  }));

  return { architecture: { nodes, edges }, warnings };
}

/** Build internal import adjacency for Start Here BFS / fan metrics. */
export function importsFromSemanticGraph(
  graph: SemanticGraph
): Map<string, Set<string>> {
  const imports = new Map<string, Set<string>>();
  for (const edge of graph.edges) {
    if (edge.resolution !== "resolved_internal" || !edge.to) continue;
    if (!edge.from.startsWith("file:") || !edge.to.startsWith("file:")) continue;
    const from = edge.from.slice("file:".length);
    const to = edge.to.slice("file:".length);
    let set = imports.get(from);
    if (!set) {
      set = new Set();
      imports.set(from, set);
    }
    set.add(to);
  }
  return imports;
}

export function fanMapsFromImports(
  files: string[],
  imports: Map<string, Set<string>>
): { fanIn: Map<string, number>; fanOut: Map<string, number> } {
  const fanIn = new Map<string, number>();
  const fanOut = new Map<string, number>();
  for (const f of files) {
    fanIn.set(f, 0);
    fanOut.set(f, 0);
  }
  for (const [from, targets] of imports) {
    fanOut.set(from, targets.size);
    for (const t of targets) {
      fanIn.set(t, (fanIn.get(t) ?? 0) + 1);
    }
  }
  return { fanIn, fanOut };
}
