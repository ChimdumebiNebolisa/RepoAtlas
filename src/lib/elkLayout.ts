import ELK from "elkjs/lib/elk.bundled.js";
import type { Architecture, ArchitectureNode, ArchitectureEdge } from "@/types/report";

export interface LayoutNode extends ArchitectureNode {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface LayoutEdge extends ArchitectureEdge {
  /** Full edge path: startPoint, bendPoints, endPoint for routed drawing */
  path: Array<{ x: number; y: number }>;
}

export interface LayoutResult {
  nodes: LayoutNode[];
  edges: LayoutEdge[];
  width: number;
  height: number;
}

export async function layoutGraph(arch: Architecture): Promise<LayoutResult> {
  const elk = new ELK();

  const nodeById = new Map(arch.nodes.map((node) => [node.id, node]));
  const nodeIds = new Set(nodeById.keys());
  const validEdges = arch.edges.filter(
    (e) =>
      nodeIds.has(e.from) &&
      nodeIds.has(e.to) &&
      e.from !== e.to
  );

  const graph = {
    id: "root",
    layoutOptions: {
      "elk.algorithm": "layered",
      "elk.direction": "DOWN",
      "elk.spacing.nodeNode": "60",
      "elk.layered.spacing.nodeNodeBetweenLayers": "80",
      "elk.layered.compaction.compact": "true",
      "elk.padding": "[top=40,left=40,bottom=40,right=40]",
    },
    children: arch.nodes.map((n) => ({
      id: n.id,
      width: Math.max(n.label.length * 8 + 20, 100),
      height: 40,
    })),
    edges: validEdges.map((e, i) => ({
      id: `e${i}`,
      sources: [e.from],
      targets: [e.to],
    })),
  };
  const edgeByLayoutId = new Map(
    validEdges.map((edge, index) => [`e${index}`, edge])
  );

  const layout = await elk.layout(graph);

  const layoutNodes: LayoutNode[] = (layout.children ?? []).flatMap((child) => {
    const node = nodeById.get(child.id);
    if (!node) return [];

    return [{
      ...node,
      x: child.x ?? 0,
      y: child.y ?? 0,
      width: child.width ?? 100,
      height: child.height ?? 40,
    }];
  });

  const layoutEdges: LayoutEdge[] = (layout.edges ?? []).flatMap((edge) => {
    const archEdge = edgeByLayoutId.get(edge.id);
    if (
      !archEdge ||
      edge.sources?.[0] !== archEdge.from ||
      edge.targets?.[0] !== archEdge.to
    ) {
      return [];
    }

    const section = (edge as {
      sections?: Array<{
        startPoint: { x: number; y: number };
        endPoint: { x: number; y: number };
        bendPoints?: Array<{ x: number; y: number }>;
      }>;
    }).sections?.[0];
    const path = section
      ? [
          section.startPoint,
          ...(section.bendPoints ?? []),
          section.endPoint,
        ]
      : [];
    return [{
      ...archEdge,
      path,
    }];
  });

  const layoutShape = layout as { width?: number; height?: number };
  return {
    nodes: layoutNodes,
    edges: layoutEdges,
    width: layoutShape.width ?? 800,
    height: layoutShape.height ?? 600,
  };
}
