import type { Architecture, ArchitectureInsights } from "@/types/report";

const LAYER_ORDER = ["app", "pages", "components", "lib", "analyzer", "api"];

function normalizePath(filePath: string): string {
  return filePath.replace(/\\/g, "/");
}

function layerOf(filePath: string): string {
  const parts = normalizePath(filePath).split("/");
  for (const layer of LAYER_ORDER) {
    if (parts.includes(layer)) return layer;
  }
  return "other";
}

export function analyzeArchitectureBoundaries(architecture: Architecture): ArchitectureInsights {
  const violations: ArchitectureInsights["violations"] = [];
  const adjacency = new Map<string, Set<string>>();
  const nodeIds = new Set(architecture.nodes.map((node) => normalizePath(node.id)));

  for (const edge of architecture.edges) {
    const from = normalizePath(edge.from);
    const to = normalizePath(edge.to);
    if (!nodeIds.has(from) || !nodeIds.has(to)) continue;
    if (!adjacency.has(from)) adjacency.set(from, new Set());
    adjacency.get(from)!.add(to);
  }

  const fanIn = new Map<string, number>();
  for (const [from, targets] of adjacency) {
    for (const to of targets) {
      const fromLayer = layerOf(from);
      const toLayer = layerOf(to);
      const fromIdx = LAYER_ORDER.indexOf(fromLayer);
      const toIdx = LAYER_ORDER.indexOf(toLayer);
      if (fromIdx >= 0 && toIdx >= 0 && fromIdx < toIdx) {
        violations.push({
          from,
          to,
          reason: `Import from ${toLayer} into ${fromLayer} may cross layer boundaries`,
        });
      }
      fanIn.set(to, (fanIn.get(to) ?? 0) + 1);
    }
  }

  const hubs = Array.from(fanIn.entries())
    .filter(([, count]) => count >= 3)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 5)
    .map(([id]) => id);

  const layers = LAYER_ORDER.filter((l) =>
    architecture.nodes.some((n) => layerOf(n.id) === l)
  );

  return {
    layers,
    violations: violations.slice(0, 10),
    circular_deps: [],
    hubs,
  };
}
