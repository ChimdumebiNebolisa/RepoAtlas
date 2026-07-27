import { TransformComponent, TransformWrapper } from "react-zoom-pan-pinch";
import type {
  LayoutEdge,
  LayoutNode,
  LayoutResult,
} from "@/lib/elkLayout";
import type { TextRelationship } from "./ArchitectureGraphEvidence";
import { ArchitectureGraphControls } from "./ArchitectureGraphControls";

interface ArchitectureGraphCanvasProps {
  layout: LayoutResult;
  relationships: Array<TextRelationship<LayoutNode, LayoutEdge>>;
  viewBox: string;
  padding: number;
  arrowMarkerId: string;
  graphTitleId: string;
  graphDescriptionId: string;
  graphDescription: string;
}

export function ArchitectureGraphCanvas({
  layout,
  relationships,
  viewBox,
  padding,
  arrowMarkerId,
  graphTitleId,
  graphDescriptionId,
  graphDescription,
}: ArchitectureGraphCanvasProps) {
  return (
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
          <ArchitectureGraphControls
            zoomIn={() => zoomIn()}
            zoomOut={() => zoomOut()}
            reset={() => resetTransform()}
          />
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
                  {relationships.map(({ edge, fromNode, toNode }, index) => {
                    const startX = fromNode.x + fromNode.width / 2 + padding;
                    const startY = fromNode.y + fromNode.height + padding;
                    const endX = toNode.x + toNode.width / 2 + padding;
                    const endY = toNode.y + padding;
                    const pathPoints =
                      edge.path.length >= 2
                        ? edge.path.map((point) => `${point.x + padding},${point.y + padding}`)
                        : null;
                    const path = pathPoints
                      ? `M ${pathPoints[0]} L ${pathPoints.slice(1).join(" L ")}`
                      : `M ${startX},${startY} L ${endX},${endY}`;

                    return (
                      <path
                        key={`${edge.from}-${edge.to}-${index}`}
                        d={path}
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
        </div>
      )}
    </TransformWrapper>
  );
}
