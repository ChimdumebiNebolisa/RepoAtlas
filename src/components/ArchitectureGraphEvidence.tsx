import type {
  Architecture,
  ArchitectureEdge,
  ArchitectureNode,
} from "@/types/report";

export interface TextRelationship<
  Node extends Pick<ArchitectureNode, "id" | "label"> = Pick<
    ArchitectureNode,
    "id" | "label"
  >,
  Edge extends Pick<ArchitectureEdge, "from" | "to"> = Pick<
    ArchitectureEdge,
    "from" | "to"
  >,
> {
  edge: Edge;
  fromNode: Node;
  toNode: Node;
}

interface ArchitectureEvidenceListsProps {
  idPrefix: string;
  nodes: Array<Pick<ArchitectureNode, "id" | "label">>;
  relationships: TextRelationship[];
  nodeHeading: string;
  relationshipHeading: string;
  emptyRelationshipCopy: string;
}

const MAX_LAYOUT_NODES = 50;

export function getBoundedArchitecture(architecture: Architecture): Architecture {
  const nodes = architecture.nodes.slice(0, MAX_LAYOUT_NODES);
  const nodeIds = new Set(nodes.map((node) => node.id));

  return {
    nodes,
    edges: architecture.edges.filter(
      (edge) =>
        edge.from !== edge.to &&
        nodeIds.has(edge.from) &&
        nodeIds.has(edge.to)
    ),
  };
}

export function getTextRelationships<
  Node extends Pick<ArchitectureNode, "id" | "label">,
  Edge extends Pick<ArchitectureEdge, "from" | "to">,
>(nodes: Node[], edges: Edge[]): Array<TextRelationship<Node, Edge>> {
  const nodeById = new Map(nodes.map((node) => [node.id, node]));

  return edges.flatMap((edge) => {
    const fromNode = nodeById.get(edge.from);
    const toNode = nodeById.get(edge.to);
    return fromNode && toNode ? [{ edge, fromNode, toNode }] : [];
  });
}

export function ArchitectureEvidenceLists({
  idPrefix,
  nodes,
  relationships,
  nodeHeading,
  relationshipHeading,
  emptyRelationshipCopy,
}: ArchitectureEvidenceListsProps) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <section aria-labelledby={`${idPrefix}-nodes`}>
        <h3 id={`${idPrefix}-nodes`} className="font-medium text-slate-900">
          {nodeHeading} ({nodes.length})
        </h3>
        <ul className="mt-2 space-y-1">
          {nodes.map((node, index) => (
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
      <section aria-labelledby={`${idPrefix}-relationships`}>
        <h3
          id={`${idPrefix}-relationships`}
          className="font-medium text-slate-900"
        >
          {relationshipHeading} ({relationships.length})
        </h3>
        {relationships.length > 0 ? (
          <ul className="mt-2 space-y-1">
            {relationships.map(({ edge, fromNode, toNode }, index) => (
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
            ))}
          </ul>
        ) : (
          <p className="mt-2 leading-6">{emptyRelationshipCopy}</p>
        )}
      </section>
    </div>
  );
}
