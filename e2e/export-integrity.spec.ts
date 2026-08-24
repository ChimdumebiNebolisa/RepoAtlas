import { expect, test, type Download, type Page } from "@playwright/test";
import fs from "fs";
import path from "path";
import { randomUUID } from "crypto";
import { createCanvas } from "@napi-rs/canvas";
import { PNG } from "pngjs";
import { getDocument, OPS } from "pdfjs-dist/legacy/build/pdf.mjs";
import type { Report } from "../src/types/report";
import { buildSampleReport } from "../src/lib/buildSampleReport";
import { buildExportFilename } from "../src/lib/exportNames";
import { MAX_PNG_CANVAS_DIMENSION } from "../src/components/useReportFormatExports";
import { REPORT_EXPORT_DEADLINE_MS } from "../src/components/reportExportRendering";
import { expectCompletedReportInViewport } from "./helpers";

const PDF_SIGNATURE = Buffer.from("%PDF-");
const PNG_SIGNATURE = Buffer.from("89504e470d0a1a0a", "hex");

async function downloadFromButton(page: Page, name: "Export PDF" | "Export PNG") {
  const downloadPromise = page.waitForEvent("download", { timeout: 120_000 });
  await page.getByRole("button", { name, exact: true }).last().click();
  return downloadPromise;
}

async function readDownload(download: Download): Promise<Buffer> {
  const downloadPath = await download.path();
  expect(downloadPath).toBeTruthy();
  const buffer = fs.readFileSync(downloadPath!);

  const artifactDir = process.env.EXPORT_ARTIFACT_DIR;
  if (artifactDir) {
    fs.mkdirSync(artifactDir, { recursive: true });
    fs.writeFileSync(path.join(artifactDir, download.suggestedFilename()), buffer);
  }

  return buffer;
}

async function openControlledInlineReport(
  page: Page,
  controlledReport?: Report
): Promise<Report> {
  let report = controlledReport;
  if (controlledReport) {
    await page.route("**/api/analyze", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          reportId: randomUUID(),
          report: controlledReport,
          persisted: false,
        }),
      });
    });
  } else {
    const analyze = await page.request.post("/api/analyze", { data: { sample: true } });
    expect(analyze.ok()).toBeTruthy();
    const body = (await analyze.json()) as {
      reportId: string;
      report?: Report;
      persisted?: boolean;
    };
    report = body.report
      ? body.report
      : ((await (await page.request.get(`/api/reports/${body.reportId}`)).json()) as Report);

    await page.route("**/api/analyze", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          reportId: randomUUID(),
          report,
          persisted: false,
        }),
      });
    });
  }

  await page.goto("/");
  await page.getByRole("button", { name: /Open the sample Candidate Brief/i }).click();
  await expectCompletedReportInViewport(page);
  await expect(
    page.getByText(
      /Markdown and saved server links require saved report storage, which is currently unavailable/i
    )
  ).toBeVisible();
  return report!;
}

function nonWhitePixelRatio(png: {
  width: number;
  height: number;
  data: Uint8Array | Uint8ClampedArray;
}): number {
  let sampled = 0;
  let nonWhite = 0;
  const stride = 97;

  for (let pixel = 0; pixel < png.width * png.height; pixel += stride) {
    const offset = pixel * 4;
    const red = png.data[offset]!;
    const green = png.data[offset + 1]!;
    const blue = png.data[offset + 2]!;
    const alpha = png.data[offset + 3]!;
    sampled += 1;
    if (alpha > 0 && (red < 250 || green < 250 || blue < 250)) nonWhite += 1;
  }

  return nonWhite / sampled;
}

test("inline Candidate Brief exports valid, readable PDF and PNG files", async ({ page }) => {
  test.setTimeout(240_000);
  const report = await openControlledInlineReport(page);

  const pdfDownload = await downloadFromButton(page, "Export PDF");
  expect(pdfDownload.suggestedFilename()).toBe(
    buildExportFilename({
      repoName: report.repo_metadata.name,
      analyzedAt: report.repo_metadata.analyzed_at,
      ext: "pdf",
    })
  );
  const pdfBuffer = await readDownload(pdfDownload);
  expect(pdfBuffer.subarray(0, PDF_SIGNATURE.length)).toEqual(PDF_SIGNATURE);
  expect(pdfBuffer.byteLength).toBeGreaterThan(10_000);

  const pdf = await getDocument({ data: new Uint8Array(pdfBuffer) }).promise;
  expect(pdf.numPages).toBeGreaterThan(0);
  const metadata = await pdf.getMetadata();
  const info = metadata.info as { Title?: string; Subject?: string };
  expect(info.Title).toMatch(/^Repo Analysis:/);
  expect(info.Subject).toBe("RepoAtlas Candidate Brief");
  const firstPage = await pdf.getPage(1);
  const viewport = firstPage.getViewport({ scale: 1 });
  expect(viewport.width).toBeGreaterThan(0);
  expect(viewport.height).toBeGreaterThan(0);
  const operators = await firstPage.getOperatorList();
  expect(
    operators.fnArray.some(
      (operator) =>
        operator === OPS.paintImageXObject ||
        operator === OPS.paintInlineImageXObject ||
        operator === OPS.paintImageMaskXObject
    )
  ).toBeTruthy();
  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const pdfPage = await pdf.getPage(pageNumber);
    const renderViewport = pdfPage.getViewport({ scale: 0.5 });
    const renderCanvas = createCanvas(
      Math.ceil(renderViewport.width),
      Math.ceil(renderViewport.height)
    );
    const renderContext = renderCanvas.getContext("2d");
    await pdfPage.render({
      canvas: null,
      canvasContext: renderContext as unknown as CanvasRenderingContext2D,
      viewport: renderViewport,
    }).promise;
    const rendered = renderContext.getImageData(
      0,
      0,
      renderCanvas.width,
      renderCanvas.height
    );
    expect(
      nonWhitePixelRatio({
        width: renderCanvas.width,
        height: renderCanvas.height,
        data: rendered.data,
      }),
      `PDF page ${pageNumber} should contain visible report content`
    ).toBeGreaterThan(0.002);
  }
  await pdf.destroy();

  const pngDownload = await downloadFromButton(page, "Export PNG");
  expect(pngDownload.suggestedFilename()).toBe(
    buildExportFilename({
      repoName: report.repo_metadata.name,
      analyzedAt: report.repo_metadata.analyzed_at,
      ext: "png",
    })
  );
  const pngBuffer = await readDownload(pngDownload);
  expect(pngBuffer.subarray(0, PNG_SIGNATURE.length)).toEqual(PNG_SIGNATURE);
  expect(pngBuffer.byteLength).toBeGreaterThan(10_000);
  const png = PNG.sync.read(pngBuffer);
  expect(png.width).toBeGreaterThan(0);
  expect(png.height).toBeGreaterThan(0);
  expect(nonWhitePixelRatio(png)).toBeGreaterThan(0.01);
});

test("long Candidate Brief exports PNG below the browser canvas limit", async ({ page }) => {
  test.setTimeout(240_000);
  const report = buildSampleReport();
  report.warnings = Array.from(
    { length: 1_000 },
    (_, index) => `Long report export regression warning ${index + 1}: ${"evidence ".repeat(8)}`
  );
  await openControlledInlineReport(page, report);

  const download = await downloadFromButton(page, "Export PNG");
  const pngBuffer = await readDownload(download);
  expect(pngBuffer.subarray(0, PNG_SIGNATURE.length)).toEqual(PNG_SIGNATURE);
  const png = PNG.sync.read(pngBuffer);
  expect(png.width).toBeGreaterThan(0);
  expect(png.height).toBeGreaterThan(0);
  expect(png.width).toBeLessThanOrEqual(MAX_PNG_CANVAS_DIMENSION);
  expect(png.height).toBeLessThanOrEqual(MAX_PNG_CANVAS_DIMENSION);
  expect(nonWhitePixelRatio(png)).toBeGreaterThan(0.01);
});

test("a stalled long-report PDF reaches recovery and unlocks report actions", async ({
  page,
}) => {
  test.setTimeout(120_000);
  await openControlledInlineReport(page, buildSampleReport());

  await page.evaluate(() => {
    const runtime = window as Window & {
      __longExportFixtureHeight?: number;
      __pdfPageEncodingStalled?: boolean;
      __originalCanvasToBlob?: typeof HTMLCanvasElement.prototype.toBlob;
    };
    const originalToBlob = HTMLCanvasElement.prototype.toBlob;
    runtime.__originalCanvasToBlob = originalToBlob;
    const observer = new MutationObserver(() => {
      const exportHeading = Array.from(document.querySelectorAll("h1")).find(
        (heading) =>
          heading.textContent?.startsWith("Repo Analysis:") &&
          heading.closest(".fixed")
      );
      const exportNode = exportHeading?.parentElement;
      if (!exportNode || exportNode.querySelector("[data-long-export-fixture]")) return;
      const filler = document.createElement("div");
      filler.dataset.longExportFixture = "true";
      filler.style.height = "31000px";
      exportNode.appendChild(filler);
      runtime.__longExportFixtureHeight = exportNode.scrollHeight;
      // Keep the long mount assertion without forcing two parallel browsers to
      // allocate a second 31,000-pixel canvas; this contract stalls page encoding.
      queueMicrotask(() => {
        filler.style.height = "1px";
      });
      observer.disconnect();
    });
    observer.observe(document.body, { childList: true, subtree: true });
    HTMLCanvasElement.prototype.toBlob = function (
      callback,
      type,
      quality
    ) {
      if (type === "image/png" && this.width >= 1_000 && this.height < 2_000) {
        runtime.__pdfPageEncodingStalled = true;
        return;
      }
      return originalToBlob.call(this, callback, type, quality);
    };
  });
  await page.clock.install();

  const pdfButton = page.getByRole("button", { name: "Export PDF", exact: true }).last();
  const pngButton = page.getByRole("button", { name: "Export PNG", exact: true }).last();
  const shareButton = page.getByRole("button", { name: "Share Candidate Brief" }).last();
  await pdfButton.click();
  await page.waitForFunction(
    () =>
      (window as Window & { __pdfPageEncodingStalled?: boolean })
        .__pdfPageEncodingStalled === true
  );
  expect(
    await page.evaluate(
      () =>
        (window as Window & { __longExportFixtureHeight?: number })
          .__longExportFixtureHeight
    )
  ).toBeGreaterThan(30_000);
  await expect(
    page.getByRole("button", { name: /Exporting PDF/i }).last()
  ).toBeDisabled();
  await expect(pngButton).toBeDisabled();

  await page.clock.fastForward(REPORT_EXPORT_DEADLINE_MS + 1);

  await expect(
    page.getByRole("alert").filter({
      hasText: "PDF export took too long. Try again or export PNG instead.",
    })
  ).toBeVisible({ timeout: 1_000 });
  await expect(pdfButton).toBeEnabled();
  await expect(pngButton).toBeEnabled();
  await expect(shareButton).toBeEnabled();

  await page.evaluate(() => {
    const originalToBlob = (
      window as Window & {
        __originalCanvasToBlob?: typeof HTMLCanvasElement.prototype.toBlob;
      }
    ).__originalCanvasToBlob;
    if (!originalToBlob) throw new Error("Missing original canvas encoder.");
    HTMLCanvasElement.prototype.toBlob = originalToBlob;
  });
  await page.clock.resume();

  const pdfDownload = await downloadFromButton(page, "Export PDF");
  const pdfBuffer = await readDownload(pdfDownload);
  expect(pdfBuffer.subarray(0, PDF_SIGNATURE.length)).toEqual(PDF_SIGNATURE);
  expect(pdfBuffer.byteLength).toBeGreaterThan(10_000);
  const pdf = await getDocument({ data: new Uint8Array(pdfBuffer) }).promise;
  expect(pdf.numPages).toBeGreaterThan(0);
  const firstPage = await pdf.getPage(1);
  const operators = await firstPage.getOperatorList();
  expect(
    operators.fnArray.some(
      (operator) =>
        operator === OPS.paintImageXObject ||
        operator === OPS.paintInlineImageXObject ||
        operator === OPS.paintImageMaskXObject
    )
  ).toBeTruthy();
  await pdf.destroy();

  const pngDownload = await downloadFromButton(page, "Export PNG");
  const pngBuffer = await readDownload(pngDownload);
  expect(pngBuffer.subarray(0, PNG_SIGNATURE.length)).toEqual(PNG_SIGNATURE);
  const png = PNG.sync.read(pngBuffer);
  expect(nonWhitePixelRatio(png)).toBeGreaterThan(0.01);

  await page.getByRole("button", { name: /Open the sample Candidate Brief/i }).click();
  await expectCompletedReportInViewport(page);
  await expect(
    page.getByRole("alert").filter({
      hasText: "PDF export took too long. Try again or export PNG instead.",
    })
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Export PDF", exact: true }).last()
  ).toBeEnabled();
  await expect(
    page.getByRole("button", { name: "Export PNG", exact: true }).last()
  ).toBeEnabled();
  await expect(
    page.getByRole("button", { name: "Share Candidate Brief" }).last()
  ).toBeEnabled();
  await expect(
    page.locator(".fixed").filter({ has: page.getByRole("heading", { name: /Repo Analysis:/ }) })
  ).toHaveCount(0);
});
