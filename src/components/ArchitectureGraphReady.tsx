import type { LayoutResult } from "@/lib/elkLayout";
import type { Architecture, SemanticGraph } from "@/types/report";
import { ArchitectureGraphCanvas } from "./ArchitectureGraphCanvas";
import {
  ArchitectureEvidenceLists,
  getTextRelationships,
} from "./ArchitectureGraphEvidence";

interface ArchitectureGraphReadyProps {
  architecture: Architecture;
  semanticGraph?: SemanticGraph;
  layout: LayoutResult;
  arrowMarkerId: string;
  graphTitleId: string;
  graphDescriptionId: string;
}

export function ArchitectureGraphReady({
  architecture,
  semanticGraph,
  layout,
  arrowMarkerId,
  graphTitleId,
  graphDescriptionId,
}: ArchitectureGraphReadyProps) {
  const padding = 20;
  const viewBox = `0 0 ${layout.width + padding * 2} ${layout.height + padding * 2}`;
  const displayedRelationships = getTextRelationships(layout.nodes, layout.edges);
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
      <ArchitectureGraphCanvas
        layout={layout}
        relationships={displayedRelationships}
        viewBox={viewBox}
        padding={padding}
        arrowMarkerId={arrowMarkerId}
        graphTitleId={graphTitleId}
        graphDescriptionId={graphDescriptionId}
        graphDescription={graphDescription}
      />
      <details className="mt-3 rounded border border-slate-200 bg-white px-3 py-2">
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
          <ArchitectureEvidenceLists
            idPrefix={graphTitleId}
            nodes={layout.nodes}
            relationships={displayedRelationships}
            nodeHeading="Displayed nodes"
            relationshipHeading="Displayed relationships"
            emptyRelationshipCopy="No relationships are displayed between these nodes."
          />
        </div>
      </details>
    </div>
  );
}
