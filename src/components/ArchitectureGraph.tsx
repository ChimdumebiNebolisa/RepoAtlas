"use client";

import { useEffect, useRef } from "react";
import type { Architecture } from "@/types/report";
import mermaid from "mermaid";

interface ArchitectureGraphProps {
  architecture: Architecture;
}

function buildMermaidFlowchart(arch: Architecture): string {
  const maxNodes = 50;
  const nodes = arch.nodes.slice(0, maxNodes);
  const nodeIds = new Set(nodes.map((n) => n.id));
  const edges = arch.edges.filter(
    (e) => nodeIds.has(e.from) && nodeIds.has(e.to) && e.from !== e.to
  );

  const safeId = (id: string) => id.replace(/[^a-zA-Z0-9_]/g, "_");
  let m = "flowchart TB\n";

  for (const n of nodes) {
    const sid = safeId(n.id);
    const label = n.label.replace(/"/g, '\\"');
    m += `    ${sid}["${label}"]\n`;
  }
  for (const e of edges) {
    const from = safeId(e.from);
    const to = safeId(e.to);
    m += `    ${from} --> ${to}\n`;
  }

  return m;
}

export function ArchitectureGraph({ architecture }: ArchitectureGraphProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!architecture.nodes.length || !containerRef.current) return;

    mermaid.initialize({ startOnLoad: false });
    const chart = buildMermaidFlowchart(architecture);
    const id = "mermaid-" + Math.random().toString(36).slice(2);

    mermaid
      .render(id, chart)
      .then(({ svg }) => {
        if (containerRef.current) {
          containerRef.current.innerHTML = svg;
        }
      })
      .catch((err) => {
        if (containerRef.current) {
          containerRef.current.innerHTML = `<pre class="text-red-600">Mermaid render error: ${err.message}</pre>`;
        }
      });
  }, [architecture]);

  if (!architecture.nodes.length) {
    return (
      <p className="text-gray-500">No architecture data available for this repository.</p>
    );
  }

  return (
    <div
      ref={containerRef}
      className="overflow-x-auto p-4 bg-gray-50 dark:bg-gray-900 rounded"
    />
  );
}
