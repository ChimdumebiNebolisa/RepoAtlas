import {
  settleBeforeReportExportDeadline,
  yieldBeforeReportExportDeadline,
} from "./reportExportRendering";

export const REPORT_EXPORT_SNAPSHOT_SLICE_HEIGHT = 2_048;

type Html2Canvas = typeof import("html2canvas").default;

function throwIfExportExpired(
  deadline: number,
  timeoutMessage: string,
  shouldContinue: () => boolean
) {
  if (!shouldContinue()) throw new Error("Report export was cancelled.");
  if (Date.now() >= deadline) throw new Error(timeoutMessage);
}

function isOutsideSnapshotSlice(
  element: Element,
  exportNode: HTMLElement,
  exportTop: number,
  sourceY: number,
  sliceHeight: number
) {
  if (!exportNode.contains(element)) return false;
  const bounds = element.getBoundingClientRect();
  if (bounds.width === 0 && bounds.height === 0) return false;
  const elementTop = bounds.top - exportTop;
  const elementBottom = elementTop + bounds.height;
  return elementBottom <= sourceY || elementTop >= sourceY + sliceHeight;
}

export async function renderReportCanvasBeforeDeadline({
  exportNode,
  html2canvas,
  scale,
  deadline,
  timeoutMessage,
  shouldContinue = () => true,
}: {
  exportNode: HTMLDivElement;
  html2canvas: Html2Canvas;
  scale: number;
  deadline: number;
  timeoutMessage: string;
  shouldContinue?: () => boolean;
}) {
  const width = Math.max(1, exportNode.scrollWidth);
  const height = Math.max(1, exportNode.scrollHeight);
  const sharedOptions = {
    backgroundColor: "#ffffff",
    scale,
    useCORS: true,
    windowWidth: 1_200,
  } as const;

  if (height <= REPORT_EXPORT_SNAPSHOT_SLICE_HEIGHT) {
    return settleBeforeReportExportDeadline(
      html2canvas(exportNode, sharedOptions),
      deadline,
      timeoutMessage
    );
  }

  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.floor(width * scale));
  canvas.height = Math.max(1, Math.floor(height * scale));
  const context = canvas.getContext("2d");
  if (!context) {
    canvas.width = 1;
    canvas.height = 1;
    throw new Error("Could not prepare the report snapshot.");
  }
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  const exportTop = exportNode.getBoundingClientRect().top;

  try {
    for (
      let sourceY = 0;
      sourceY < height;
      sourceY += REPORT_EXPORT_SNAPSHOT_SLICE_HEIGHT
    ) {
      throwIfExportExpired(deadline, timeoutMessage, shouldContinue);
      await yieldBeforeReportExportDeadline(
        deadline,
        timeoutMessage
      );
      throwIfExportExpired(deadline, timeoutMessage, shouldContinue);
      const sliceHeight = Math.min(
        REPORT_EXPORT_SNAPSHOT_SLICE_HEIGHT,
        height - sourceY
      );
      const slice = await settleBeforeReportExportDeadline(
        html2canvas(exportNode, {
          ...sharedOptions,
          y: sourceY,
          width,
          height: sliceHeight,
          ignoreElements: (element) =>
            isOutsideSnapshotSlice(
              element,
              exportNode,
              exportTop,
              sourceY,
              sliceHeight
            ),
        }),
        deadline,
        timeoutMessage
      );
      throwIfExportExpired(deadline, timeoutMessage, shouldContinue);
      const targetY = Math.floor(sourceY * scale);
      const targetEnd = Math.floor((sourceY + sliceHeight) * scale);
      context.drawImage(
        slice,
        0,
        0,
        slice.width,
        slice.height,
        0,
        targetY,
        canvas.width,
        Math.max(1, targetEnd - targetY)
      );
      slice.width = 1;
      slice.height = 1;
    }
    return canvas;
  } catch (error) {
    canvas.width = 1;
    canvas.height = 1;
    throw error;
  }
}
