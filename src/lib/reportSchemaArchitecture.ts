import {
  isNonNegativeInteger,
  isObject,
  isOneOf,
  isStringArray,
  uniqueIds,
} from "./reportSchemaPrimitives";

const SEMANTIC_NODE_KINDS = [
  "file",
  "package",
  "module",
  "declaration",
  "entrypoint",
] as const;
const SEMANTIC_EDGE_KINDS = [
  "import",
  "dynamic_import",
  "require",
  "re_export",
  "package_dependency",
] as const;
const RESOLUTION_STATUSES = [
  "resolved_internal",
  "resolved_external",
  "unresolved",
  "ignored",
] as const;

export function isArchitectureNode(value: unknown): boolean {
  if (!isObject(value)) return false;
  if (typeof value.id !== "string" || typeof value.label !== "string")
    return false;
  return (
    value.type == null ||
    isOneOf(value.type, ["file", "module", "folder"] as const)
  );
}

export function isArchitectureEdge(value: unknown): boolean {
  if (!isObject(value)) return false;
  if (typeof value.from !== "string" || typeof value.to !== "string")
    return false;
  return (
    value.type == null || isOneOf(value.type, ["import", "dependency"] as const)
  );
}

export function isSemanticGraph(value: unknown): boolean {
  if (!isObject(value) || !isNonNegativeInteger(value.version)) return false;
  if (typeof value.language !== "string" || typeof value.adapter !== "string")
    return false;
  if (!Array.isArray(value.nodes) || !Array.isArray(value.edges)) return false;
  if (!isObject(value.stats) || !isStringArray(value.warnings)) return false;
  if (
    !value.nodes.every(
      (node) =>
        isObject(node) &&
        typeof node.id === "string" &&
        isOneOf(node.kind, SEMANTIC_NODE_KINDS) &&
        typeof node.label === "string" &&
        (node.language == null || typeof node.language === "string") &&
        (node.entrypoint_reason == null ||
          typeof node.entrypoint_reason === "string"),
    )
  ) {
    return false;
  }
  for (const key of [
    "node_count",
    "edge_count",
    "resolved_internal",
    "resolved_external",
    "unresolved",
    "ignored",
    "entrypoint_count",
  ] as const) {
    if (!isNonNegativeInteger(value.stats[key])) return false;
  }
  for (const edge of value.edges) {
    if (!isObject(edge)) return false;
    if (
      typeof edge.id !== "string" ||
      typeof edge.from !== "string" ||
      (edge.to != null && typeof edge.to !== "string") ||
      typeof edge.specifier !== "string" ||
      !isOneOf(edge.kind, SEMANTIC_EDGE_KINDS) ||
      !isOneOf(edge.resolution, RESOLUTION_STATUSES) ||
      !isObject(edge.evidence) ||
      typeof edge.evidence.path !== "string" ||
      !isNonNegativeInteger(edge.evidence.line_start) ||
      !isNonNegativeInteger(edge.evidence.line_end) ||
      (edge.evidence.snippet != null &&
        typeof edge.evidence.snippet !== "string") ||
      (edge.reason != null && typeof edge.reason !== "string") ||
      (edge.type_only != null && typeof edge.type_only !== "boolean")
    ) {
      return false;
    }
  }
  return true;
}

export function hasValidArchitectureIntegrity(
  architecture: Record<string, unknown>,
): boolean {
  const nodes = architecture.nodes as Array<Record<string, unknown>>;
  const nodeIds = uniqueIds(nodes);
  if (!nodeIds) return false;
  return (architecture.edges as Array<Record<string, unknown>>).every(
    (edge) =>
      typeof edge.from === "string" &&
      typeof edge.to === "string" &&
      nodeIds.has(edge.from) &&
      nodeIds.has(edge.to),
  );
}

export function hasValidSemanticGraphIntegrity(
  semanticGraph: Record<string, unknown>,
): boolean {
  const nodes = semanticGraph.nodes as Array<Record<string, unknown>>;
  const edges = semanticGraph.edges as Array<Record<string, unknown>>;
  const nodeIds = uniqueIds(nodes);
  const edgeIds = uniqueIds(edges);
  if (!nodeIds || !edgeIds) return false;

  const resolutionCounts = new Map(
    RESOLUTION_STATUSES.map((status) => [status, 0]),
  );
  for (const edge of edges) {
    if (
      typeof edge.from !== "string" ||
      !nodeIds.has(edge.from) ||
      (edge.to != null &&
        (typeof edge.to !== "string" || !nodeIds.has(edge.to)))
    ) {
      return false;
    }
    const evidence = edge.evidence as Record<string, unknown>;
    if ((evidence.line_start as number) > (evidence.line_end as number)) {
      return false;
    }
    const resolution = edge.resolution as (typeof RESOLUTION_STATUSES)[number];
    resolutionCounts.set(resolution, (resolutionCounts.get(resolution) ?? 0) + 1);
  }

  const stats = semanticGraph.stats as Record<string, unknown>;
  return (
    stats.node_count === nodes.length &&
    stats.edge_count === edges.length &&
    RESOLUTION_STATUSES.every(
      (status) => stats[status] === resolutionCounts.get(status),
    ) &&
    stats.entrypoint_count ===
      nodes.filter((node) => node.kind === "entrypoint").length
  );
}
