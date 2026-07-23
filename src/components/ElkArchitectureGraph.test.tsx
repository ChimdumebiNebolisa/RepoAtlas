import React from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { LayoutResult } from "@/lib/elkLayout";
import type { Architecture, SemanticGraph } from "@/types/report";
import { ElkArchitectureGraph } from "./ElkArchitectureGraph";

const layoutGraph = vi.hoisted(() => vi.fn());
const zoomPanHarness = vi.hoisted(() => ({
  transformWrapperProps: vi.fn(),
  transformComponentProps: vi.fn(),
}));

vi.mock("@/lib/elkLayout", () => ({ layoutGraph }));
vi.mock("react-zoom-pan-pinch", async () => {
  const ReactModule = await import("react");

  function TransformWrapper({
    children,
    ...props
  }: {
    children: (controls: {
      zoomIn: () => void;
      zoomOut: () => void;
      resetTransform: () => void;
    }) => React.ReactNode;
  }) {
    const [scale, setScale] = ReactModule.useState(1);
    const [panCount, setPanCount] = ReactModule.useState(0);
    zoomPanHarness.transformWrapperProps(props);

    return (
      <div
        data-testid="transform-wrapper"
        data-scale={scale}
        data-pan-count={panCount}
        onPointerDown={() => setPanCount((count) => count + 1)}
      >
        {children({
          zoomIn: () => setScale((value) => value + 0.5),
          zoomOut: () => setScale((value) => value - 0.5),
          resetTransform: () => setScale(1),
        })}
      </div>
    );
  }

  function TransformComponent({
    children,
    ...props
  }: {
    children: React.ReactNode;
  }) {
    zoomPanHarness.transformComponentProps(props);
    return <div data-testid="transform-component">{children}</div>;
  }

  return { TransformComponent, TransformWrapper };
});

const baseArchitecture: Architecture = {
  nodes: [
    { id: "entry", label: "Entry" },
    { id: "service", label: "Service" },
  ],
  edges: [{ from: "entry", to: "service" }],
};

const baseLayout: LayoutResult = {
  nodes: [
    { id: "entry", label: "Entry", x: 0, y: 0, width: 100, height: 40 },
    { id: "service", label: "Service", x: 0, y: 120, width: 100, height: 40 },
  ],
  edges: [
    {
      from: "entry",
      to: "service",
      path: [
        { x: 50, y: 40 },
        { x: 50, y: 120 },
      ],
    },
  ],
  width: 180,
  height: 200,
};

function buildSemanticGraph(unresolved: number): SemanticGraph {
  return {
    version: 1,
    language: "typescript",
    adapter: "tsjs",
    nodes: [],
    edges: Array.from({ length: unresolved }, (_, index) => ({
      id: `unresolved-${index}`,
      from: "entry",
      specifier: `missing-${index}`,
      kind: "import" as const,
      resolution: "unresolved" as const,
      evidence: {
        path: `src/file-${index}.ts`,
        line_start: index + 1,
        line_end: index + 1,
      },
      reason: index === 0 ? "not found" : undefined,
    })),
    stats: {
      node_count: 2,
      edge_count: unresolved + 5,
      resolved_internal: 3,
      resolved_external: 2,
      unresolved,
      ignored: 0,
      entrypoint_count: 1,
    },
    warnings: [],
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, reject, resolve };
}

beforeEach(() => {
  layoutGraph.mockReset();
  zoomPanHarness.transformWrapperProps.mockReset();
  zoomPanHarness.transformComponentProps.mockReset();
});

afterEach(() => {
  cleanup();
});

describe("ElkArchitectureGraph states", () => {
  it("renders the empty state without starting the graph engine", () => {
    render(<ElkArchitectureGraph architecture={{ nodes: [], edges: [] }} />);

    const emptyState = screen.getByText("No dependency map was produced.").closest(
      '[data-architecture-state="empty"]'
    );

    expect(emptyState).toHaveTextContent(
      "RepoAtlas found 0 graph nodes and 0 graph edges from supported dependency analysis."
    );
    expect(emptyState).toHaveTextContent(
      "This does not prove that the repository has no architecture."
    );
    expect(emptyState).toHaveTextContent(
      "Use Folder Map and Start Here to inspect the repository structure."
    );
    expect(emptyState).toHaveTextContent(
      "Check Candidate Brief confidence notes for analysis limits."
    );
    expect(layoutGraph).not.toHaveBeenCalled();
  });

  it("shows a loading state until a deterministic layout is ready", async () => {
    const pendingLayout = deferred<LayoutResult>();
    layoutGraph.mockReturnValueOnce(pendingLayout.promise);
    const { container } = render(
      <ElkArchitectureGraph architecture={baseArchitecture} />
    );

    expect(screen.getByText("Computing layout...")).toHaveAttribute(
      "data-architecture-state",
      "loading"
    );

    await act(async () => pendingLayout.resolve(baseLayout));

    expect(await screen.findByText("Entry")).toBeInTheDocument();
    expect(container.querySelector('[data-architecture-state="ready"]')).toBeInTheDocument();
  });

  it("caps large graphs and removes self-references before layout", async () => {
    const architecture: Architecture = {
      nodes: Array.from({ length: 52 }, (_, index) => ({
        id: `node-${index}`,
        label: `Node ${index}`,
      })),
      edges: [
        { from: "node-0", to: "node-0" },
        { from: "node-0", to: "node-1" },
      ],
    };
    layoutGraph.mockResolvedValueOnce({ ...baseLayout, edges: [] });

    render(<ElkArchitectureGraph architecture={architecture} />);
    await screen.findByText("Entry");

    expect(layoutGraph).toHaveBeenCalledWith({
      nodes: architecture.nodes.slice(0, 50),
      edges: [{ from: "node-0", to: "node-1" }],
    });
  });

  it("recovers when a failed graph is replaced by a valid one", async () => {
    layoutGraph
      .mockRejectedValueOnce(new Error("ELK could not place this graph"))
      .mockResolvedValueOnce(baseLayout);
    const { rerender } = render(
      <ElkArchitectureGraph architecture={baseArchitecture} />
    );

    expect(await screen.findByText("Layout error: ELK could not place this graph")).toHaveAttribute(
      "data-architecture-state",
      "error"
    );

    const replacement = {
      nodes: [{ id: "replacement", label: "Replacement" }],
      edges: [],
    };
    rerender(<ElkArchitectureGraph architecture={replacement} />);

    expect(screen.getByText("Computing layout...")).toBeInTheDocument();
    expect(await screen.findByText("Entry")).toBeInTheDocument();
    expect(screen.queryByText(/Layout error:/)).not.toBeInTheDocument();
  });

  it("ignores stale layout completion after the architecture changes", async () => {
    const firstLayout = deferred<LayoutResult>();
    const secondLayout = deferred<LayoutResult>();
    layoutGraph
      .mockReturnValueOnce(firstLayout.promise)
      .mockReturnValueOnce(secondLayout.promise);
    const { rerender } = render(
      <ElkArchitectureGraph architecture={baseArchitecture} />
    );
    const replacement = {
      nodes: [{ id: "replacement", label: "Replacement" }],
      edges: [],
    };

    rerender(<ElkArchitectureGraph architecture={replacement} />);
    await act(async () => firstLayout.resolve(baseLayout));
    expect(screen.getByText("Computing layout...")).toBeInTheDocument();

    const replacementLayout: LayoutResult = {
      ...baseLayout,
      nodes: [
        {
          id: "replacement",
          label: "Replacement",
          x: 0,
          y: 0,
          width: 120,
          height: 40,
        },
      ],
      edges: [],
    };
    await act(async () => secondLayout.resolve(replacementLayout));

    expect(await screen.findByText("Replacement")).toBeInTheDocument();
    expect(screen.queryByText("Entry")).not.toBeInTheDocument();
  });

  it("uses a bounded message for a non-error layout rejection", async () => {
    layoutGraph.mockRejectedValueOnce("unstructured failure");

    render(<ElkArchitectureGraph architecture={baseArchitecture} />);

    expect(await screen.findByText("Layout error: Layout failed")).toBeInTheDocument();
  });
});

describe("ElkArchitectureGraph evidence and drawing", () => {
  it("summarizes internal, external, and unresolved edges with a bounded sample", async () => {
    layoutGraph.mockResolvedValueOnce(baseLayout);
    render(
      <ElkArchitectureGraph
        architecture={baseArchitecture}
        semanticGraph={buildSemanticGraph(10)}
      />
    );

    expect(
      await screen.findByText(
        "Semantic graph: 3 internal, 2 external, 10 unresolved edges (adapter tsjs)."
      )
    ).toBeInTheDocument();
    expect(screen.getByText("Unresolved imports (10)")).toBeInTheDocument();
    expect(screen.getByText(/src\/file-0\.ts:1/).closest("li")).toHaveTextContent(
      "missing-0 (not found)"
    );
    expect(screen.getByText("…and 2 more (see report JSON / Markdown export)")).toBeInTheDocument();
    expect(screen.queryByText(/src\/file-8\.ts:9/)).not.toBeInTheDocument();
  });

  it("uses singular unresolved-edge copy and hides details when the count is zero", async () => {
    layoutGraph.mockResolvedValue(baseLayout);
    const { rerender } = render(
      <ElkArchitectureGraph
        architecture={baseArchitecture}
        semanticGraph={buildSemanticGraph(1)}
      />
    );

    expect(
      await screen.findByText(
        "Semantic graph: 3 internal, 2 external, 1 unresolved edge (adapter tsjs)."
      )
    ).toBeInTheDocument();

    rerender(
      <ElkArchitectureGraph
        architecture={{ ...baseArchitecture }}
        semanticGraph={buildSemanticGraph(0)}
      />
    );
    expect(
      await screen.findByText(
        "Semantic graph: 3 internal, 2 external, 0 unresolved edges (adapter tsjs)."
      )
    ).toBeInTheDocument();
    expect(screen.queryByText(/Unresolved imports/)).not.toBeInTheDocument();
  });

  it("draws routed and fallback edges while skipping edges with missing nodes", async () => {
    layoutGraph.mockResolvedValueOnce({
      ...baseLayout,
      edges: [
        baseLayout.edges[0],
        { from: "service", to: "entry", path: [] },
        { from: "entry", to: "missing", path: [] },
      ],
    });
    const { container } = render(
      <ElkArchitectureGraph architecture={baseArchitecture} />
    );
    await screen.findByText("Entry");

    const paths = container.querySelectorAll("g.edges path");
    expect(paths).toHaveLength(2);
    expect(paths[0]).toHaveAttribute("d", "M 70,60 L 70,140");
    expect(paths[1]).toHaveAttribute("d", "M 70,180 L 70,20");
    expect(paths[0].getAttribute("marker-end")).toMatch(/^url\(#arrowhead-/);
  });
});

describe("ElkArchitectureGraph interactions", () => {
  it("supports keyboard zoom, reset, and pointer panning with accessible controls", async () => {
    layoutGraph.mockResolvedValueOnce(baseLayout);
    const user = userEvent.setup();
    render(<ElkArchitectureGraph architecture={baseArchitecture} />);
    await screen.findByText("Entry");
    const transform = screen.getByTestId("transform-wrapper");

    await user.tab();
    expect(screen.getByRole("button", { name: "Zoom in" })).toHaveFocus();
    await user.keyboard("{Enter}");
    expect(transform).toHaveAttribute("data-scale", "1.5");

    await user.click(screen.getByRole("button", { name: "Zoom out" }));
    expect(transform).toHaveAttribute("data-scale", "1");
    await user.click(screen.getByRole("button", { name: "Zoom out" }));
    expect(transform).toHaveAttribute("data-scale", "0.5");
    await user.click(screen.getByRole("button", { name: "Reset" }));
    expect(transform).toHaveAttribute("data-scale", "1");

    const panCount = Number(transform.getAttribute("data-pan-count"));
    fireEvent.pointerDown(transform);
    expect(transform).toHaveAttribute("data-pan-count", String(panCount + 1));
    expect(zoomPanHarness.transformWrapperProps).toHaveBeenLastCalledWith(
      expect.objectContaining({
        panning: { velocityDisabled: true },
        minScale: 0.5,
        maxScale: 3,
      })
    );
  });

  it("keeps the graph fluid and clipped when the viewport narrows", async () => {
    layoutGraph.mockResolvedValueOnce(baseLayout);
    const { container } = render(
      <ElkArchitectureGraph architecture={baseArchitecture} />
    );
    await screen.findByText("Entry");
    const graphViewport = screen.getByTestId("transform-component").parentElement;
    const svg = container.querySelector("svg");

    expect(graphViewport).toHaveClass("overflow-hidden");
    expect(svg).toHaveAttribute("width", "100%");
    expect(svg).toHaveAttribute("height", "100%");
    expect(zoomPanHarness.transformComponentProps).toHaveBeenLastCalledWith({
      wrapperClass: "!w-full !h-full",
      contentClass: "!w-full !h-full",
    });

    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      value: 390,
    });
    fireEvent(window, new Event("resize"));
    expect(svg).toHaveAttribute("width", "100%");
  });
});
