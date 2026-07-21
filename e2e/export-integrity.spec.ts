import { expect, test, type Download, type Page } from "@playwright/test";
import fs from "fs";
import path from "path";
import { randomUUID } from "crypto";
import { PNG } from "pngjs";
import { getDocument, OPS } from "pdfjs-dist/legacy/build/pdf.mjs";
import type { Report } from "../src/types/report";
import { buildSampleReport } from "../src/lib/buildSampleReport";
import { MAX_PNG_CANVAS_DIMENSION } from "../src/components/ReportTabs";
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

async function openControlledInlineReport(page: Page, controlledReport?: Report) {
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
  } else if (!process.env.PLAYWRIGHT_EXTERNAL_URL) {
    const analyze = await page.request.post("/api/analyze", { data: { sample: true } });
    expect(analyze.ok()).toBeTruthy();
    const body = (await analyze.json()) as {
      reportId: string;
      report?: Report;
      persisted?: boolean;
    };
    const report = body.report
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
  await page.getByRole("button", { name: /Generate sample Candidate Brief/i }).click();
  await expectCompletedReportInViewport(page);
  await expect(
    page.getByText(
      /Markdown and saved server links require saved report storage, which is currently unavailable/i
    )
  ).toBeVisible();
}

function nonWhitePixelRatio(png: PNG): number {
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
  await openControlledInlineReport(page);

  const pdfDownload = await downloadFromButton(page, "Export PDF");
  expect(pdfDownload.suggestedFilename()).toMatch(/\.pdf$/);
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
  await pdf.destroy();

  const pngDownload = await downloadFromButton(page, "Export PNG");
  expect(pngDownload.suggestedFilename()).toMatch(/\.png$/);
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
