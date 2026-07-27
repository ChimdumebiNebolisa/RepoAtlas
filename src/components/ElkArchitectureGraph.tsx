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
  const graphTitleId = useId();
  const graphDescriptionId = useId();
  const [layoutState, setLayoutState] = useState<{
    architecture: Architecture;
    layout: LayoutResult | null;
    error: string | null;
  } | null>(null);

  useEffect(() => {
    if (!architecture.nodes.length) return;
    let active = true;

    const filteredArch = {
      nodes: architecture.nodes.slice(0, 50),
      edges: architecture.edges.filter((e) => e.from !== e.to),
    };

    layoutGraph(filteredArch)
      .then((layout) => {
        if (active) {
          setLayoutState({ architecture, layout, error: null });
        }
      })
      .catch((err) => {
        if (active) {
          setLayoutState({
            architecture,
            layout: null,
            error: err instanceof Error ? err.message : "Layout failed",
          });
        }
      });

    return () => {
      active = false;
    };
  }, [architecture]);

  const currentLayoutState =
    layoutState?.architecture === architecture ? layoutState : null;
  const layout = currentLayoutState?.layout ?? null;
  const error = currentLayoutState?.error ?? null;

  if (!architecture.nodes.length) {
    return (
      <div
        data-architecture-state="empty"
        className="max-w-2xl rounded-lg border border-slate-200 bg-slate-50 px-4 py-3"
      >
        <p className="font-medium text-slate-900">No dependency map was produced.</p>
        <p className="mt-1 text-sm leading-6 text-slate-700">
          RepoAtlas found {architecture.nodes.length} graph nodes and{" "}
          {architecture.edges.length} graph edges from supported dependency analysis. This does
          not prove that the repository has no architecture.
        </p>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          Use Folder Map and Start Here to inspect the repository structure. Check Candidate Brief
          confidence notes for analysis limits.
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <pre data-architecture-state="error" className="text-red-600">
        Layout error: {error}
      </pre>
    );
  }

  if (!layout) {
    return (
      <p data-architecture-state="loading" className="text-gray-500">
        Computing layout...
      </p>
    );
  }

  const padding = 20;
  const viewBox = `0 0 ${layout.width + padding * 2} ${layout.height + padding * 2}`;
  const nodeById = new Map(layout.nodes.map((node) => [node.id, node]));
  const displayedRelationships = layout.edges.flatMap((edge) => {
    const fromNode = nodeById.get(edge.from);
    const toNode = nodeById.get(edge.to);
    return fromNode && toNode ? [{ edge, fromNode, toNode }] : [];
  });
  const relationshipCount = displayedRelationships.length;
  const graphDescription = `The map shows ${layout.nodes.length} repository node${
    layout.nodes.length === 1 ? "" : "s"
  } and ${relationshipCount} supported relationship${
    relationshipCount === 1 ? "" : "s"
  }. Use the controls to pan and zoom, or read the same evidence as text below. External and unresolved imports are counted separately.`;

  const unresolvedCount = semanticGraph?.stats.unresolved ?? 0;
  const externalCount = semanticGraph?.stats.resolved_external ?? 0;
  const unresolvedSample =
    semanticGraph?.edges
      .filter((edge) => edge.resolution === "unresolved")
      .slice(0, 8) ?? [];

  return (
    <div data-architecture-state="ready" className="rounded bg-gray-50 p-4 min-h-[400px]">
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
                  role="img"
                  aria-labelledby={graphTitleId}
                  aria-describedby={graphDescriptionId}
                >
                  <title id={graphTitleId}>Architecture dependency map</title>
                  <desc id={graphDescriptionId}>{graphDescription}</desc>
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
                    {displayedRelationships.map(({ edge, fromNode, toNode }, i) => {
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
                          data-architecture-edge
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

            <details className="rounded border border-slate-200 bg-white px-3 py-2">
              <summary className="cursor-pointer font-medium text-slate-900">
                Read architecture as text
              </summary>
              <div className="mt-3 space-y-4 text-sm text-slate-700">
                <p className="leading-6">
                  This text view matches the nodes and relationships displayed in the map.
                  External and unresolved imports are not drawn as relationships.
                </p>
                {architecture.nodes.length > layout.nodes.length && (
                  <p className="rounded bg-slate-100 px-3 py-2 text-xs leading-5 text-slate-600">
                    The displayed map contains {layout.nodes.length} of{" "}
                    {architecture.nodes.length} repository nodes.
                  </p>
                )}
                <div className="grid gap-4 md:grid-cols-2">
                  <section aria-labelledby={`${graphTitleId}-nodes`}>
                    <h3 id={`${graphTitleId}-nodes`} className="font-medium text-slate-900">
                      Displayed nodes ({layout.nodes.length})
                    </h3>
                    <ul className="mt-2 space-y-1">
                      {layout.nodes.map((node, index) => (
                        <li
                          key={`${node.id}-${index}`}
                          className="break-all rounded bg-slate-50 px-2 py-1.5"
                          data-architecture-text-node
                        >
                          <code>{node.label}</code>
                        </li>
                      ))}
                    </ul>
                  </section>
                  <section aria-labelledby={`${graphTitleId}-relationships`}>
                    <h3
                      id={`${graphTitleId}-relationships`}
                      className="font-medium text-slate-900"
                    >
                      Displayed relationships ({relationshipCount})
                    </h3>
                    {relationshipCount > 0 ? (
                      <ul className="mt-2 space-y-1">
                        {displayedRelationships.map(
                          ({ edge, fromNode, toNode }, index) => (
                            <li
                              key={`${edge.from}-${edge.to}-${index}`}
                              className="break-all rounded bg-slate-50 px-2 py-1.5"
                              data-architecture-text-relationship
                            >
                              <code>{fromNode.label}</code>{" "}
                              <span aria-hidden="true">→</span>
                              <span className="sr-only"> to </span>{" "}
                              <code>{toNode.label}</code>
                            </li>
                          )
                        )}
                      </ul>
                    ) : (
                      <p className="mt-2 leading-6">
                        No relationships are displayed between these nodes.
                      </p>
                    )}
                  </section>
                </div>
              </div>
            </details>
          </div>
        )}
      </TransformWrapper>
    </div>
  );
}
