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
  // The clone must use the viewport that produced `height`; otherwise mobile
  // layout is measured tall but rendered at desktop breakpoints, blanking the
  // trailing slices.
  const windowWidth = Math.max(
    1,
    exportNode.ownerDocument.defaultView?.innerWidth ?? 1_200
  );
  const sharedOptions = {
    backgroundColor: "#ffffff",
    scale,
    useCORS: true,
    windowWidth,
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
