import type { Report } from "@/types/report";

export const REPORT_EXPORT_DEADLINE_MS = 90_000;
export const PDF_EXPORT_TIMEOUT_MESSAGE =
  "PDF export took too long. Try again or export PNG instead.";
export const PNG_EXPORT_TIMEOUT_MESSAGE =
  "PNG export took too long. Try again or export PDF instead.";

export function createReportExportDeadline() {
  return Date.now() + REPORT_EXPORT_DEADLINE_MS;
}

export async function settleBeforeReportExportDeadline<T>(
  operation: Promise<T>,
  deadline: number,
  timeoutMessage: string
): Promise<T> {
  const remaining = deadline - Date.now();
  if (remaining <= 0) throw new Error(timeoutMessage);

  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      operation,
      new Promise<never>((_, reject) => {
        timeoutId = setTimeout(
          () => reject(new Error(timeoutMessage)),
          remaining
        );
      }),
    ]);
  } finally {
    if (timeoutId !== undefined) clearTimeout(timeoutId);
  }
}

export function canvasToBlobBeforeDeadline(
  canvas: HTMLCanvasElement,
  deadline: number,
  timeoutMessage: string
) {
  return settleBeforeReportExportDeadline(
    new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/png", 1)
    ),
    deadline,
    timeoutMessage
  );
}

export async function renderPdfBeforeDeadline(
  report: Report,
  canvas: HTMLCanvasElement,
  deadline: number
) {
  const { default: jsPDF } = await settleBeforeReportExportDeadline(
    import("jspdf"),
    deadline,
    PDF_EXPORT_TIMEOUT_MESSAGE
  );
  const pdf = new jsPDF({ orientation: "p", unit: "pt", format: "a4" });
  pdf.setProperties({
    title: `Repo Analysis: ${report.repo_metadata.name}`,
    subject: "RepoAtlas Candidate Brief",
    creator: "RepoAtlas",
  });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 24;
  const renderWidth = pageWidth - margin * 2;
  const renderHeight = pageHeight - margin * 2;
  const sourcePageHeight = Math.max(
    1,
    Math.floor((renderHeight * canvas.width) / renderWidth)
  );

  for (let sourceY = 0, pageIndex = 0; sourceY < canvas.height; pageIndex += 1) {
    const sliceHeight = Math.min(sourcePageHeight, canvas.height - sourceY);
    const slice = document.createElement("canvas");
    slice.width = canvas.width;
    slice.height = sliceHeight;
    const context = slice.getContext("2d");
    if (!context) throw new Error("Could not prepare a PDF page.");
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, slice.width, slice.height);
    context.drawImage(
      canvas,
      0,
      sourceY,
      canvas.width,
      sliceHeight,
      0,
      0,
      canvas.width,
      sliceHeight
    );
    const blob = await canvasToBlobBeforeDeadline(
      slice,
      deadline,
      PDF_EXPORT_TIMEOUT_MESSAGE
    );
    if (!blob) throw new Error("Could not generate a PDF page image.");
    const imageBytes = new Uint8Array(
      await settleBeforeReportExportDeadline(
        blob.arrayBuffer(),
        deadline,
        PDF_EXPORT_TIMEOUT_MESSAGE
      )
    );
    const pageRenderHeight = (sliceHeight * renderWidth) / canvas.width;
    if (pageIndex > 0) pdf.addPage();
    pdf.addImage(
      imageBytes,
      "PNG",
      margin,
      margin,
      renderWidth,
      pageRenderHeight,
      undefined,
      "FAST"
    );
    slice.width = 1;
    slice.height = 1;
    sourceY += sliceHeight;
  }
  return pdf.output("blob");
}
