import { useEffect, useMemo, useState } from "react";
import { layoutGraph, type LayoutResult } from "@/lib/elkLayout";
import type { Architecture } from "@/types/report";
import { getBoundedArchitecture } from "./ArchitectureGraphEvidence";

interface LayoutState {
  architecture: Architecture;
  layout: LayoutResult | null;
  error: boolean;
}

export function useArchitectureGraphLayout(architecture: Architecture) {
  const [layoutState, setLayoutState] = useState<LayoutState | null>(null);
  const boundedArchitecture = useMemo(
    () => getBoundedArchitecture(architecture),
    [architecture]
  );

  useEffect(() => {
    if (!architecture.nodes.length) return;
    let active = true;

    layoutGraph(boundedArchitecture)
      .then((layout) => {
        if (active) {
          setLayoutState({ architecture, layout, error: false });
        }
      })
      .catch(() => {
        if (active) {
          setLayoutState({ architecture, layout: null, error: true });
        }
      });

    return () => {
      active = false;
    };
  }, [architecture, boundedArchitecture]);

  const currentLayoutState =
    layoutState?.architecture === architecture ? layoutState : null;

  return {
    boundedArchitecture,
    layout: currentLayoutState?.layout ?? null,
    error: currentLayoutState?.error ?? null,
  };
}
