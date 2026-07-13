"use client";

import { useEffect, useId, useState } from "react";
import { TransformComponent, TransformWrapper } from "react-zoom-pan-pinch";
import type { Architecture, SemanticGraph } from "@/types/report";
import { layoutGraph, type LayoutResult } from "@/lib/elkLayout";

interface ElkArchitectureGraphProps {
  architecture: Architecture;
  semanticGraph?: SemanticGraph;
}

export function ElkArchitectureGraph({
  architecture,
  semanticGraph,
}: ElkArchitectureGraphProps) {
  const rawMarkerId = useId();
  const arrowMarkerId = `arrowhead-${rawMarkerId.replace(/[^a-zA-Z0-9_-]/g, "")}`;
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

  const unresolvedCount = semanticGraph?.stats.unresolved ?? 0;
  const externalCount = semanticGraph?.stats.resolved_external ?? 0;
  const unresolvedSample =
    semanticGraph?.edges
      .filter((edge) => edge.resolution === "unresolved")
      .slice(0, 8) ?? [];

  return (
    <div className="rounded bg-gray-50 p-4 min-h-[400px]">
      {semanticGraph && (
        <div className="mb-3 space-y-2 text-sm text-slate-700">
          <p>
            Semantic graph: {semanticGraph.stats.resolved_internal} internal,{" "}
            {externalCount} external, {unresolvedCount} unresolved edge
            {unresolvedCount === 1 ? "" : "s"} (adapter {semanticGraph.adapter}).
          </p>
          {unresolvedCount > 0 && (
            <details className="rounded border border-amber-200 bg-amber-50 p-2">
              <summary className="cursor-pointer font-medium text-amber-900">
                Unresolved imports ({unresolvedCount})
              </summary>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-amber-950">
                {unresolvedSample.map((edge) => (
                  <li key={edge.id}>
                    <code>{edge.evidence.path}:{edge.evidence.line_start}</code>{" "}
                    <code>{edge.specifier}</code>
                    {edge.reason ? ` (${edge.reason})` : ""}
                  </li>
                ))}
                {unresolvedCount > unresolvedSample.length && (
                  <li>
                    …and {unresolvedCount - unresolvedSample.length} more (see
                    report JSON / Markdown export)
                  </li>
                )}
              </ul>
            </details>
          )}
        </div>
      )}
      <TransformWrapper
        initialScale={1}
        minScale={0.5}
        maxScale={3}
        wheel={{ step: 0.12 }}
        panning={{ velocityDisabled: true }}
        doubleClick={{ disabled: true }}
      >
        {({ zoomIn, zoomOut, resetTransform }) => (
          <div className="space-y-3">
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => zoomIn()}
                className="report-action report-action-secondary report-action-compact"
              >
                Zoom in
              </button>
              <button
                type="button"
                onClick={() => zoomOut()}
                className="report-action report-action-secondary report-action-compact"
              >
                Zoom out
              </button>
              <button
                type="button"
                onClick={() => resetTransform()}
                className="report-action report-action-secondary report-action-compact"
              >
                Reset
              </button>
            </div>

            <div className="h-[420px] overflow-hidden rounded border border-slate-200 bg-white">
              <TransformComponent wrapperClass="!w-full !h-full" contentClass="!w-full !h-full">
                <svg
                  width="100%"
                  height="100%"
                  viewBox={viewBox}
                  className="mx-auto block"
                  style={{ minHeight: "400px" }}
                >
                  <defs>
                    <marker
                      id={arrowMarkerId}
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
                          markerEnd={`url(#${arrowMarkerId})`}
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
                          className="fill-white stroke-slate-300"
                          strokeWidth="1.5"
                        />
                        <text
                          x={node.x + node.width / 2 + padding}
                          y={node.y + node.height / 2 + padding + 4}
                          textAnchor="middle"
                          className="text-sm fill-slate-900"
                          style={{ fontSize: "13px" }}
                        >
                          {node.label}
                        </text>
                      </g>
                    ))}
                  </g>
                </svg>
              </TransformComponent>
            </div>
          </div>
        )}
      </TransformWrapper>
    </div>
  );
}
