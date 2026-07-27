"use client";

import { useId } from "react";
import type { Architecture, SemanticGraph } from "@/types/report";
import { ArchitectureGraphReady } from "./ArchitectureGraphReady";
import {
  ArchitectureGraphEmpty,
  ArchitectureGraphFailure,
  ArchitectureGraphLoading,
} from "./ArchitectureGraphStates";
import { useArchitectureGraphLayout } from "./useArchitectureGraphLayout";

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
  const { boundedArchitecture, layout, error } =
    useArchitectureGraphLayout(architecture);

  if (!architecture.nodes.length) {
    return <ArchitectureGraphEmpty architecture={architecture} />;
  }

  if (error) {
    return (
      <ArchitectureGraphFailure
        architecture={architecture}
        boundedArchitecture={boundedArchitecture}
        idPrefix={graphTitleId}
      />
    );
  }

  if (!layout) {
    return <ArchitectureGraphLoading />;
  }

  return (
    <ArchitectureGraphReady
      architecture={architecture}
      semanticGraph={semanticGraph}
      layout={layout}
      arrowMarkerId={arrowMarkerId}
      graphTitleId={graphTitleId}
      graphDescriptionId={graphDescriptionId}
    />
  );
}
