import { test, expect } from "@playwright/test";
import fs from "fs";
import { randomUUID } from "crypto";
import {
  REPORTS_DIR,
  legacyReportWithoutBrief,
  runSampleAnalyzeOnPage,
  writeReport,
} from "./helpers";

test.describe("Candidate Brief smoke", () => {
  test("homepage loads with sample action", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("Candidate Brief Generator")).toBeVisible();
    await expect(
      page.getByRole("button", { name: /Try sample Candidate Brief/i })
    ).toBeVisible();
  });

  test("sample analyze renders Candidate Brief tab", async ({ page }) => {
    await runSampleAnalyzeOnPage(page);
    await expect(page.getByRole("heading", { name: "Repo Summary" }).last()).toBeVisible();
    await expect(page.getByRole("heading", { name: "Reading Path" }).last()).toBeVisible();
    const talkingPoints = page
      .getByRole("heading", { name: "Interview Talking Points" })
      .last()
      .locator("xpath=ancestor::section[1]");
    await expect(
      talkingPoints.getByRole("heading", { name: "What tradeoffs does this repository contain?" })
    ).toBeVisible();
    await expect(
      talkingPoints.getByText(/repository directly shows Next\.js, Vitest as technical choices/i)
    ).toBeVisible();
    await expect(talkingPoints.getByRole("button", { name: "decision-1" })).toBeVisible();
    await expect(talkingPoints.getByText("Extra preparation")).toBeVisible();
  });

  test("walkthrough buttons copy the exact 30-second and 2-minute scripts", async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(navigator, "clipboard", {
        configurable: true,
        value: {
          writeText: async (text: string) => {
            (window as typeof window & { copiedWalkthroughs?: string[] }).copiedWalkthroughs ??= [];
            (window as typeof window & { copiedWalkthroughs: string[] }).copiedWalkthroughs.push(text);
          },
        },
      });
    });
    await runSampleAnalyzeOnPage(page);

    const walkthroughHeading = page.getByRole("heading", { name: "Walkthrough Script" }).last();
    const walkthroughSection = walkthroughHeading.locator("xpath=ancestor::section[1]");
    const thirtySecond = (await walkthroughSection.getByText("30-second").locator("xpath=..//p[2]").textContent()) ?? "";
    const twoMinute = (await walkthroughSection.getByText("2-minute").locator("xpath=..//p[2]").textContent()) ?? "";

    await walkthroughSection.getByRole("button", { name: "Copy 30s" }).click();
    await expect(walkthroughSection.getByRole("status").first()).toHaveText("Copied to clipboard.");
    await walkthroughSection.getByRole("button", { name: "Copy 2min" }).click();
    await expect(walkthroughSection.getByRole("status").nth(1)).toHaveText("Copied to clipboard.");

    await expect
      .poll(() =>
        page.evaluate(
          () => (window as typeof window & { copiedWalkthroughs?: string[] }).copiedWalkthroughs
        )
      )
      .toEqual([thirtySecond, twoMinute]);
  });

  test("invalid share token shows error", async ({ page }) => {
    await page.goto("/share/not-a-valid-share-token");
    await expect(page.getByText(/expired|not found/i)).toBeVisible();
  });

  test("homepage preview sample shows Candidate Brief sections", async ({ page }) => {
    await page.setViewportSize({ width: 1400, height: 1000 });
    await page.goto("/");
    await page.getByRole("button", { name: /^Open sample report/i }).first().click();
    await expect(page.getByRole("heading", { name: "Repo Summary" }).first()).toBeVisible({
      timeout: 30_000,
    });
  });

  test("sample analyze exports Markdown from Export tab", async ({ page }) => {
    await runSampleAnalyzeOnPage(page);

    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("tab", { name: "Export" }).last().click();
    await page.getByRole("button", { name: /Export Markdown/i }).last().click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/\.md$/);

    const downloadPath = await download.path();
    expect(downloadPath).toBeTruthy();
    const markdown = fs.readFileSync(downloadPath!, "utf-8");
    expect(markdown).toContain("# Repo Analysis");
    expect(markdown).toMatch(/Candidate Brief|Repo Summary/i);
  });

  test("report without candidate_brief shows fallback message", async ({ page }) => {
    const reportId = randomUUID();
    writeReport(reportId, legacyReportWithoutBrief());

    await page.goto(`/report/${reportId}`);
    await expect(page.getByText(/Candidate Brief is not available/i).first()).toBeVisible();
  });
});
