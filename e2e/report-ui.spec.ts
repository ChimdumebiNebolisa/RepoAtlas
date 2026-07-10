import { test, expect } from "@playwright/test";
import fs from "fs";
import path from "path";
import { randomUUID } from "crypto";
import {
  REPORTS_DIR,
  REPORT_TABS,
  analyzeSample,
  minimalReport,
  runSampleAnalyzeOnPage,
  writeReport,
  zipFixture,
} from "./helpers";

test.describe("Report UI flows", () => {
  test("all report tabs render after sample analyze", async ({ page }) => {
    await runSampleAnalyzeOnPage(page);

    for (const tab of REPORT_TABS) {
      const tabControl = page.getByRole("tab", { name: tab, exact: true }).last();
      await tabControl.click();
      await expect(tabControl).toHaveAttribute("aria-selected", "true");
    }

    await page.getByRole("tab", { name: "Candidate Brief", exact: true }).last().click();
    await expect(page.getByRole("heading", { name: "Repo Summary" }).last()).toBeVisible();

    await page.getByRole("tab", { name: "Folder Map", exact: true }).last().click();
    await expect(page.locator("section").filter({ hasText: "Generated report ready for" })).toBeVisible();

    await page.getByRole("tab", { name: "Start Here", exact: true }).last().click();
    await expect(
      page.getByText("Suggested reading order for interview prep").last()
    ).toBeVisible();

    await page.getByRole("tab", { name: "Danger Zones", exact: true }).last().click();
    await expect(page.getByText("Files that may need extra attention").last()).toBeVisible();

    await page.getByRole("tab", { name: "Export", exact: true }).last().click();
    await expect(page.getByText("Export Report").last()).toBeVisible();
  });

  test("Overview tab shows share link creation and opens shared view", async ({ page }) => {
    await runSampleAnalyzeOnPage(page);

    await page.getByRole("tab", { name: "Overview", exact: true }).last().click();
    await expect(page.getByText(/Share read-only Candidate Brief/i)).toBeVisible();
    await page.getByRole("button", { name: /Create share link/i }).click();

    const shareLink = page.locator('a[href*="/share/"]').last();
    await expect(shareLink).toBeVisible({ timeout: 15_000 });
    const href = await shareLink.getAttribute("href");
    expect(href).toMatch(/\/share\//);

    await page.goto(href!);
    await expect(page.getByText(/Shared Candidate Brief/i)).toBeVisible();
    await expect(page.getByRole("heading", { name: "Repo Summary" }).first()).toBeVisible({
      timeout: 30_000,
    });
  });

  test("partial report shows status badge on Overview", async ({ page }) => {
    const reportId = randomUUID();
    writeReport(
      reportId,
      minimalReport({
        partial: true,
        report_version: 2,
        repo_metadata: {
          name: "partial-e2e",
          url: "zip",
          branch: "main",
          clone_hash: null,
          analyzed_at: new Date().toISOString(),
        },
        warnings: ["Analysis timed out; partial results saved."],
      })
    );

    await page.goto(`/report/${reportId}`);
    await page.getByRole("tab", { name: "Overview", exact: true }).click();
    await expect(page.getByText(/Partial report/i)).toBeVisible();
  });

  test("homepage preview disables Markdown export (no reportId)", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: /^Open sample report/i }).first().click();
    await page.getByRole("tab", { name: "Export", exact: true }).first().click();
    const mdButton = page.getByRole("button", { name: /Export Markdown/i }).first();
    await expect(mdButton).toBeDisabled();
  });

  test("zip upload via file input produces Candidate Brief", async ({ page }) => {
    const zipPath = path.join(REPORTS_DIR, "upload-repo-ts.zip");
    fs.mkdirSync(REPORTS_DIR, { recursive: true });
    fs.writeFileSync(zipPath, zipFixture("repo-ts"));

    await page.goto("/");
    await page.locator('input[type="file"]').setInputFiles(zipPath);
    await page.getByRole("button", { name: /Analyze Repository/i }).first().click();

    await expect(page.getByRole("button", { name: /View report/i })).toBeVisible({
      timeout: 90_000,
    });
    await page.getByRole("button", { name: /View report/i }).click();
    await expect(page.getByRole("heading", { name: "Repo Summary" }).last()).toBeVisible();
    await expect(page.getByRole("heading", { name: "First PR Plan" }).last()).toBeVisible();
  });

  test("non-zip file selection shows client-side error", async ({ page }) => {
    const txtPath = path.join(REPORTS_DIR, "not-a-zip.txt");
    fs.mkdirSync(REPORTS_DIR, { recursive: true });
    fs.writeFileSync(txtPath, "hello");

    await page.goto("/");
    await page.locator('input[type="file"]').setInputFiles(txtPath);
    await expect(page.getByText(/Please select a \.zip file/i)).toBeVisible();
    await page.getByRole("button", { name: /Analyze Repository/i }).first().click();
    await expect(page.getByRole("alert")).toContainText(/zip/i);
  });

  test("missing report id on /report/:id shows error", async ({ page }) => {
    await page.goto(`/report/${randomUUID()}`);
    await expect(page.getByText(/not found|Report not found/i)).toBeVisible();
  });

  test("demo mode toggle is development-only (hidden in production builds)", async ({ page }) => {
    await runSampleAnalyzeOnPage(page);
    await expect(
      page.getByRole("checkbox", { name: /Screenshot \/ demo mode/i })
    ).toHaveCount(0);
  });
});

test.describe("Share UI edge cases", () => {
  test("expired share token shows error on share page", async ({ page, request }) => {
    const reportId = await analyzeSample(request);
    const create = await request.post(`/api/reports/${reportId}/share`);
    const share = await create.json();

    const recordPath = path.join(REPORTS_DIR, "shares", `${share.token}.json`);
    const record = JSON.parse(fs.readFileSync(recordPath, "utf-8"));
    record.expiresAt = new Date(Date.now() - 60_000).toISOString();
    fs.writeFileSync(recordPath, JSON.stringify(record));

    await page.goto(`/share/${share.token}`);
    await expect(page.getByText(/expired|not found/i)).toBeVisible();
  });
});
