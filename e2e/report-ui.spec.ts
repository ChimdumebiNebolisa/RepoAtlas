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
import { buildSampleReport } from "../src/lib/buildSampleReport";
import { PORTABLE_SHARE_MAX_URL_LENGTH } from "../src/lib/portableSharing";

test.describe("Report UI flows", () => {
  test("all report tabs render after sample analyze", async ({ page }) => {
    await runSampleAnalyzeOnPage(page);

    const reportTabs = page
      .getByRole("tablist", { name: "Report sections" })
      .last()
      .getByRole("tab");
    const reportPanel = page.locator(".report-tabs").last().getByRole("tabpanel");
    const panelEvidence: Record<(typeof REPORT_TABS)[number], RegExp> = {
      "Candidate Brief": /Repo Summary/i,
      Overview: /Repository/i,
      "Folder Map": /bootstrap\.ts/i,
      "Architecture Map": /Semantic graph:/i,
      "Start Here": /Suggested reading order for interview prep/i,
      "Danger Zones": /Files that may need extra attention/i,
      "Run & Contribute": /Run commands/i,
      Export: /Export Report/i,
    };

    await expect(reportTabs).toHaveCount(REPORT_TABS.length);
    await expect(
      page.getByRole("tablist", { name: "Report sections" }).last()
    ).toHaveAttribute("aria-orientation", "horizontal");
    await expect(reportTabs.first()).toHaveAttribute("tabindex", "0");
    for (let index = 1; index < REPORT_TABS.length; index += 1) {
      await expect(reportTabs.nth(index)).toHaveAttribute("tabindex", "-1");
    }

    await reportTabs.first().focus();
    for (let index = 1; index < REPORT_TABS.length; index += 1) {
      await page.keyboard.press("ArrowRight");
      const tabControl = reportTabs.nth(index);
      await expect(tabControl).toBeFocused();
      await expect(tabControl).toHaveAttribute("aria-selected", "true");
      await expect(tabControl).toHaveAttribute("tabindex", "0");
      await expect(reportPanel).toContainText(panelEvidence[REPORT_TABS[index]]);
      const tabId = await tabControl.getAttribute("id");
      expect(tabId).toBeTruthy();
      await expect(reportPanel).toHaveAttribute(
        "aria-labelledby",
        tabId as string
      );
    }

    await page.keyboard.press("Home");
    await expect(reportTabs.first()).toBeFocused();
    await expect(reportTabs.first()).toHaveAttribute("aria-selected", "true");
    await page.keyboard.press("End");
    await expect(reportTabs.last()).toBeFocused();
    await expect(reportTabs.last()).toHaveAttribute("aria-selected", "true");
    await page.keyboard.press("ArrowRight");
    await expect(reportTabs.first()).toBeFocused();
    await page.keyboard.press("ArrowLeft");
    await expect(reportTabs.last()).toBeFocused();
    await expect(reportPanel).toHaveAttribute("tabindex", "0");

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

  test("completed brief shares a stored private link and opens the recipient view", async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(Navigator.prototype, "share", {
        configurable: true,
        value: undefined,
      });
      Object.defineProperty(Navigator.prototype, "clipboard", {
        configurable: true,
        get() {
          return {
            writeText: async (value: string) => {
              window.sessionStorage.setItem("repoatlas-e2e-stored-share-url", value);
            },
          };
        },
      });
    });
    await runSampleAnalyzeOnPage(page);

    await expect(page.getByText(/Share this Candidate Brief privately/i)).toBeVisible();
    await page.getByRole("button", { name: /Share Candidate Brief/i }).click();

    const shareLink = page.getByRole("link", { name: /Open shared copy/i });
    await expect(shareLink).toBeVisible({ timeout: 15_000 });
    const href = await shareLink.getAttribute("href");
    expect(href).toMatch(/\/share\//);
    await expect
      .poll(() => page.evaluate(() => window.sessionStorage.getItem("repoatlas-e2e-stored-share-url")))
      .toBe(href);

    await page.goto(href!);
    await expect(page.getByText(/Shared Candidate Brief/i)).toBeVisible();
    await expect(page.getByRole("heading", { name: "Repo Summary" }).first()).toBeVisible({
      timeout: 30_000,
    });
  });

  test("completed brief uses native sharing when the browser provides it", async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(window.navigator, "share", {
        configurable: true,
        value: async (data: ShareData) => {
          window.sessionStorage.setItem("repoatlas-e2e-native-share-invoked", "true");
          window.sessionStorage.setItem("repoatlas-e2e-native-share", JSON.stringify(data));
        },
      });
      window.sessionStorage.setItem("repoatlas-e2e-native-share-ready", "true");
    });
    await runSampleAnalyzeOnPage(page);

    await expect
      .poll(() =>
        page.evaluate(() => ({
          ownsShare: Object.prototype.hasOwnProperty.call(window.navigator, "share"),
          ready: window.sessionStorage.getItem("repoatlas-e2e-native-share-ready"),
        }))
      )
      .toEqual({ ownsShare: true, ready: "true" });

    await page.getByRole("button", { name: /Share Candidate Brief/i }).click();

    await expect(page.getByText(/Shared successfully/i)).toBeVisible();
    const sharedData = await page.evaluate(() => {
      const value = window.sessionStorage.getItem("repoatlas-e2e-native-share");
      return value ? (JSON.parse(value) as ShareData) : null;
    });
    await expect
      .poll(() =>
        page.evaluate(() =>
          window.sessionStorage.getItem("repoatlas-e2e-native-share-invoked")
        )
      )
      .toBe("true");
    expect(sharedData?.url).toMatch(/\/share\//);
    expect(sharedData?.title).toBe("RepoAtlas Candidate Brief");
  });

  test("inline report shares a bounded portable link without a storage or token request", async ({ page }) => {
    const report = buildSampleReport();
    let portableApiRequested = false;

    await page.addInitScript(() => {
      Object.defineProperty(Navigator.prototype, "share", {
        configurable: true,
        value: undefined,
      });
      Object.defineProperty(Navigator.prototype, "clipboard", {
        configurable: true,
        get() {
          return {
            writeText: async (value: string) => {
              window.sessionStorage.setItem("repoatlas-e2e-share-url", value);
            },
          };
        },
      });
    });
    await page.route("**/api/analyze", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          reportId: "550e8400-e29b-41d4-a716-446655440000",
          report,
          persisted: false,
        }),
      });
    });
    page.on("request", (request) => {
      if (request.url().includes("/api/share/portable")) portableApiRequested = true;
    });

    await page.goto("/");
    await expect(page.getByRole("button", { name: /Share Candidate Brief/i })).toHaveCount(0);
    await page.getByRole("button", { name: /Generate sample Candidate Brief/i }).click();
    await page.getByRole("button", { name: /View report/i }).click();

    const exportSummary = page.getByText(
      /Generated report ready for PDF and PNG export and 7-day encrypted browser sharing\. Markdown and saved server links require saved report storage, which is currently unavailable\./i
    );
    await expect(exportSummary).toBeVisible();
    const markdownButton = page.getByRole("button", { name: /Export Markdown/i }).first();
    await expect(markdownButton).toBeDisabled();
    await expect(markdownButton).toHaveAttribute("title", /saved report storage/i);

    await page.getByRole("button", { name: /Share Candidate Brief/i }).click();

    await expect(page.getByText(/Private link copied/i)).toBeVisible();
    const href = await page.evaluate(() =>
      window.sessionStorage.getItem("repoatlas-e2e-share-url")
    );
    expect(href).toMatch(/\/share\/portable#v1\./);
    expect(href!.length).toBeLessThan(PORTABLE_SHARE_MAX_URL_LENGTH);

    await page.goto(href!);
    await expect(page.getByText(/decrypted in this browser/i)).toBeVisible();
    await expect(page.getByRole("heading", { name: "Repo Summary" }).first()).toBeVisible();
    expect(portableApiRequested).toBe(false);
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
    await page.getByRole("tab", { name: "Upload ZIP" }).click();
    await page.locator('input[type="file"]').setInputFiles(zipPath);
    await page.getByRole("button", { name: /Analyze uploaded ZIP/i }).first().click();

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
    await page.getByRole("tab", { name: "Upload ZIP" }).click();
    await page.locator('input[type="file"]').setInputFiles(txtPath);
    const uploadError = page.getByRole("alert").filter({ hasText: /Please select a \.zip file/i });
    await expect(uploadError).toHaveText(/Please select a \.zip file/i);
    await expect(page.locator('input[type="file"]')).toHaveAttribute("aria-invalid", "true");
    await expect(page.locator('input[type="file"]')).toHaveAttribute(
      "aria-describedby",
      "input-form-error"
    );
    await page.getByRole("button", { name: /Analyze uploaded ZIP/i }).first().click();
    await expect(page.getByRole("alert").filter({ hasText: /Choose a \.zip file/i })).toBeVisible();
  });

  test("missing report id on /report/:id shows error", async ({ page }) => {
    await page.goto(`/report/${randomUUID()}`);
    await expect(page.getByRole("alert").filter({ hasText: /not found/i })).toHaveText(
      /Report not found/i
    );
    const recovery = page.getByRole("link", { name: /Start a new analysis/i });
    await expect(recovery).toHaveAttribute("href", "/#analyze");
    await recovery.focus();
    await expect(recovery).toBeFocused();
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
    await expect(page.getByRole("alert").filter({ hasText: /expired|not found/i })).toHaveText(
      /expired|not found/i
    );
    await expect(page.getByRole("button", { name: "Retry" })).toBeVisible();
    await expect(page.getByRole("link", { name: /Back to home/i })).toHaveAttribute("href", "/");
  });
});
