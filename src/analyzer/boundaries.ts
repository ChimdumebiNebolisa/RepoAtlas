import type { Architecture, ArchitectureInsights } from "@/types/report";

const LAYER_ORDER = ["app", "pages", "components", "lib", "analyzer", "api"];

function layerOf(path: string): string {
  const parts = path.replace(/\\/g, "/").split("/");
  for (const layer of LAYER_ORDER) {
    if (parts.includes(layer)) return layer;
  }
  return "other";
}

export function analyzeArchitectureBoundaries(architecture: Architecture): ArchitectureInsights {
  const violations: ArchitectureInsights["violations"] = [];
  const adjacency = new Map<string, Set<string>>();

  for (const edge of architecture.edges) {
    if (!adjacency.has(edge.from)) adjacency.set(edge.from, new Set());
    adjacency.get(edge.from)!.add(edge.to);
  }

  for (const edge of architecture.edges) {
    const fromLayer = layerOf(edge.from);
    const toLayer = layerOf(edge.to);
    const fromIdx = LAYER_ORDER.indexOf(fromLayer);
    const toIdx = LAYER_ORDER.indexOf(toLayer);
    if (fromIdx >= 0 && toIdx >= 0 && fromIdx < toIdx) {
      violations.push({
        from: edge.from,
        to: edge.to,
        reason: `Import from ${toLayer} into ${fromLayer} may cross layer boundaries`,
      });
    }
  }

  const fanIn = new Map<string, number>();
  for (const edge of architecture.edges) {
    fanIn.set(edge.to, (fanIn.get(edge.to) ?? 0) + 1);
  }
  const hubs = Array.from(fanIn.entries())
    .filter(([, count]) => count >= 3)
    .sort((a, b) => b[1] - a[1])
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
