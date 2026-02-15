"use client";

import { useEffect, useState } from "react";
import type { Architecture } from "@/types/report";
import { layoutGraph, type LayoutResult } from "@/lib/elkLayout";

interface ElkArchitectureGraphProps {
  architecture: Architecture;
}

export function ElkArchitectureGraph({ architecture }: ElkArchitectureGraphProps) {
  const [layout, setLayout] = useState<LayoutResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!architecture.nodes.length) return;

    const filteredArch = {
      nodes: architecture.nodes.slice(0, 50),
      edges: architecture.edges.filter((e) => e.from !== e.to),
    };

    layoutGraph(filteredArch)
      .then(setLayout)
      .catch((err) => setError(err instanceof Error ? err.message : "Layout failed"));
  }, [architecture]);

  if (!architecture.nodes.length) {
    return (
      <p className="text-gray-500">No architecture data available for this repository.</p>
    );
  }

  if (error) {
    return <pre className="text-red-600">Layout error: {error}</pre>;
  }

  if (!layout) {
    return <p className="text-gray-500">Computing layout...</p>;
  }

  const padding = 20;
  const viewBox = `0 0 ${layout.width + padding * 2} ${layout.height + padding * 2}`;

  return (
    <div className="overflow-x-auto overflow-y-auto p-4 bg-gray-50 dark:bg-gray-900 rounded min-h-[400px]">
      <svg
        width="100%"
        height="100%"
        viewBox={viewBox}
        className="mx-auto"
        style={{ minHeight: "400px" }}
      >
        <defs>
          <marker
            id="arrowhead"
            markerWidth="10"
            markerHeight="10"
            refX="8"
            refY="3"
            orient="auto"
            className="text-slate-400"
          >
            <polygon points="0 0, 10 3, 0 6" fill="currentColor" />
          </marker>
        </defs>

        <g className="edges">
          {layout.edges.map((edge, i) => {
            const fromNode = layout.nodes.find((n) => n.id === edge.from);
            const toNode = layout.nodes.find((n) => n.id === edge.to);
            if (!fromNode || !toNode) return null;

            const startX = fromNode.x + fromNode.width / 2 + padding;
            const startY = fromNode.y + fromNode.height + padding;
            const endX = toNode.x + toNode.width / 2 + padding;
            const endY = toNode.y + padding;

            const pathPoints =
              edge.path.length >= 2
                ? edge.path.map((p) => `${p.x + padding},${p.y + padding}`)
                : null;
            const d = pathPoints
              ? `M ${pathPoints[0]} L ${pathPoints.slice(1).join(" L ")}`
              : `M ${startX},${startY} L ${endX},${endY}`;

            return (
              <path
                key={`${edge.from}-${edge.to}-${i}`}
                d={d}
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                className="text-slate-400"
                markerEnd="url(#arrowhead)"
              />
            );
          })}
        </g>

        <g className="nodes">
          {layout.nodes.map((node) => (
            <g key={node.id}>
              <rect
                x={node.x + padding}
                y={node.y + padding}
                width={node.width}
                height={node.height}
                rx="6"
                className="fill-white stroke-slate-300 dark:fill-slate-800 dark:stroke-slate-600"
                strokeWidth="1.5"
              />
              <text
                x={node.x + node.width / 2 + padding}
                y={node.y + node.height / 2 + padding + 4}
                textAnchor="middle"
                className="text-sm fill-slate-900 dark:fill-slate-100"
                style={{ fontSize: "13px" }}
              >
                {node.label}
              </text>
            </g>
          ))}
        </g>
      </svg>
    </div>
  );
}
