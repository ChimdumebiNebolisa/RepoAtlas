import { afterEach, describe, expect, it, vi } from "vitest";
import {
  renderReportCanvasBeforeDeadline,
  REPORT_EXPORT_SNAPSHOT_SLICE_HEIGHT,
} from "./reportExportSnapshot";

function exportNode(width: number, height: number) {
  const node = document.createElement("div");
  Object.defineProperties(node, {
    scrollWidth: { configurable: true, value: width },
    scrollHeight: { configurable: true, value: height },
  });
  vi.spyOn(node, "getBoundingClientRect").mockReturnValue({
    top: 0,
    bottom: height,
    left: 0,
    right: width,
    width,
    height,
    x: 0,
    y: 0,
    toJSON: () => ({}),
  });
  return node;
}

function canvas(width = 1_200, height = REPORT_EXPORT_SNAPSHOT_SLICE_HEIGHT) {
  return { width, height } as HTMLCanvasElement;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("renderReportCanvasBeforeDeadline", () => {
  it("keeps a normal report on the established single-snapshot path", async () => {
    const node = exportNode(1_200, 1_800);
    const snapshot = canvas(1_800, 2_700);
    const html2canvas = vi.fn().mockResolvedValue(snapshot);

    await expect(
      renderReportCanvasBeforeDeadline({
        exportNode: node,
        html2canvas,
        scale: 1.5,
        deadline: Date.now() + 1_000,
        timeoutMessage: "timed out",
      })
    ).resolves.toBe(snapshot);
    expect(html2canvas).toHaveBeenCalledWith(node, {
      backgroundColor: "#ffffff",
      scale: 1.5,
      useCORS: true,
      windowWidth: 1_200,
    });
  });

  it("renders a long report in bounded slices and excludes off-slice descendants", async () => {
    const node = exportNode(1_000, 5_000);
    const laterChild = document.createElement("section");
    node.appendChild(laterChild);
    vi.spyOn(laterChild, "getBoundingClientRect").mockReturnValue({
      top: 2_500,
      bottom: 2_600,
      left: 0,
      right: 100,
      width: 100,
      height: 100,
      x: 0,
      y: 2_500,
      toJSON: () => ({}),
    });
    const zeroSizeChild = document.createElement("span");
    node.appendChild(zeroSizeChild);
    const unrelated = document.createElement("aside");
    const drawImage = vi.fn();
    const fillRect = vi.fn();
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
      fillStyle: "",
      fillRect,
      drawImage,
    } as unknown as CanvasRenderingContext2D);
    const html2canvas = vi.fn().mockImplementation(
      async (
        _node: HTMLElement,
        options: { height: number; ignoreElements: (element: Element) => boolean }
      ) => canvas(1_000, options.height)
    );

    const result = await renderReportCanvasBeforeDeadline({
      exportNode: node,
      html2canvas,
      scale: 1,
      deadline: Date.now() + 1_000,
      timeoutMessage: "timed out",
    });

    expect(result.width).toBe(1_000);
    expect(result.height).toBe(5_000);
    expect(html2canvas).toHaveBeenCalledTimes(3);
    expect(html2canvas.mock.calls.map(([, options]) => options.y)).toEqual([
      0, 2_048, 4_096,
    ]);
    expect(html2canvas.mock.calls.map(([, options]) => options.height)).toEqual([
      2_048, 2_048, 904,
    ]);
    const firstOptions = html2canvas.mock.calls[0]![1];
    const secondOptions = html2canvas.mock.calls[1]![1];
    expect(firstOptions.ignoreElements(laterChild)).toBe(true);
    expect(secondOptions.ignoreElements(laterChild)).toBe(false);
    expect(firstOptions.ignoreElements(zeroSizeChild)).toBe(false);
    expect(firstOptions.ignoreElements(unrelated)).toBe(false);
    expect(fillRect).toHaveBeenCalledTimes(1);
    expect(drawImage).toHaveBeenCalledTimes(3);
  });

  it("releases the assembled canvas when the active export loses authority", async () => {
    const node = exportNode(1_000, 5_000);
    const assembled = document.createElement("canvas");
    const originalCreateElement = document.createElement.bind(document);
    vi.spyOn(document, "createElement").mockImplementation((tagName) =>
      tagName === "canvas" ? assembled : originalCreateElement(tagName)
    );
    vi.spyOn(assembled, "getContext").mockReturnValue({
      fillStyle: "",
      fillRect: vi.fn(),
      drawImage: vi.fn(),
    } as unknown as CanvasRenderingContext2D);
    const html2canvas = vi.fn();

    await expect(
      renderReportCanvasBeforeDeadline({
        exportNode: node,
        html2canvas,
        scale: 1,
        deadline: Date.now() + 1_000,
        timeoutMessage: "timed out",
        shouldContinue: () => false,
      })
    ).rejects.toThrow("Report export was cancelled.");
    expect(html2canvas).not.toHaveBeenCalled();
    expect(assembled.width).toBe(1);
    expect(assembled.height).toBe(1);
  });

  it("fails safely when the assembled canvas has no drawing context", async () => {
    const node = exportNode(1_000, 5_000);
    const assembled = document.createElement("canvas");
    const originalCreateElement = document.createElement.bind(document);
    vi.spyOn(document, "createElement").mockImplementation((tagName) =>
      tagName === "canvas" ? assembled : originalCreateElement(tagName)
    );
    vi.spyOn(assembled, "getContext").mockReturnValue(null);

    await expect(
      renderReportCanvasBeforeDeadline({
        exportNode: node,
        html2canvas: vi.fn(),
        scale: 1,
        deadline: Date.now() + 1_000,
        timeoutMessage: "timed out",
      })
    ).rejects.toThrow("Could not prepare the report snapshot.");
    expect(assembled.width).toBe(1);
    expect(assembled.height).toBe(1);
  });
});
