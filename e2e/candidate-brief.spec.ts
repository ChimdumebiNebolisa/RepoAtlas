import { test, expect } from "@playwright/test";
import fs from "fs";
import { randomUUID } from "crypto";
import {
  REPORTS_DIR,
  expectCompletedReportInViewport,
  legacyReportWithoutBrief,
  runSampleAnalyzeOnPage,
  writeReport,
} from "./helpers";

test.describe("Candidate Brief smoke", () => {
  test("homepage hero leads with a complete bundled sample", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("Candidate Brief Generator")).toBeVisible();
    const hero = page.locator(".hero");

    await expect(
      hero.getByRole("heading", {
        name: "Walk through the repository with file-backed talking points.",
      })
    ).toBeVisible();
    await expect(hero.getByText("TypeScript/JavaScript, Python, and Java")).toBeVisible();
    await expect(hero.locator(".btn-primary")).toHaveCount(1);
    await expect(hero.getByRole("link", { name: /Use your own repository/i })).toHaveAttribute(
      "href",
      "#analyze"
    );

    await hero.getByRole("button", { name: /Try bundled sample/i }).click();
    await expectCompletedReportInViewport(page);
  });

  test("homepage shows the four Candidate Brief outputs before analysis", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/");

    const outcomes = page.getByTestId("walkthrough-outcomes");
    await expect(outcomes.getByRole("heading", { name: "Entry points" })).toBeVisible();
    await expect(outcomes.getByRole("heading", { name: "Architecture" })).toBeVisible();
    await expect(outcomes.getByRole("heading", { name: "Risk signals" })).toBeVisible();
    await expect(outcomes.getByRole("heading", { name: "Reading order" })).toBeVisible();
    await expect(outcomes).toContainText("PDF and PNG exports are ready");
    await expect(outcomes).not.toContainText("Markdown");

    const isBeforeAnalysis = await outcomes.evaluate((section) => {
      const analysis = document.querySelector("#analyze");

      return Boolean(
        analysis &&
          section.compareDocumentPosition(analysis) & Node.DOCUMENT_POSITION_FOLLOWING
      );
    });
    expect(isBeforeAnalysis).toBe(true);

    await expect(page.locator("main > section")).toHaveCount(5);
    await expect(
      page.getByRole("heading", { name: "Start with the sample or your repository." })
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "See the evidence before you add a repository." })
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "The useful boundaries stay visible." })
    ).toBeVisible();
    await expect(page.getByRole("heading", { name: "Works across project types." })).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "Built for the questions interviewers ask." })).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "A simple pipeline. A defensible output." })).toHaveCount(0);

    const pageShape = await page.evaluate(() => ({
      height: document.documentElement.scrollHeight,
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    }));
    expect(pageShape.height).toBeLessThanOrEqual(5_178);
    expect(pageShape.overflow).toBeLessThanOrEqual(0);
  });

  test("brief output summary stays compact at 390px", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");

    const outcomes = page.getByTestId("walkthrough-outcomes");
    await expect(outcomes).toBeVisible();
    await expect(outcomes.getByRole("article")).toHaveCount(4);

    const dimensions = await page.evaluate(() => ({
      height: document.documentElement.scrollHeight,
      documentWidth: document.documentElement.scrollWidth,
      viewportWidth: window.innerWidth,
      analysisTop:
        document.querySelector("#analyze")?.getBoundingClientRect().top ?? Number.POSITIVE_INFINITY,
      primaryActions: Array.from(document.querySelectorAll<HTMLElement>("main .btn-primary")).map(
        (element) => ({
          top: element.getBoundingClientRect().top,
          bottom: element.getBoundingClientRect().bottom,
        })
      ),
    }));
    expect(dimensions.documentWidth).toBeLessThanOrEqual(dimensions.viewportWidth);
    expect(dimensions.height).toBeLessThanOrEqual(8_300);
    expect(dimensions.analysisTop).toBeLessThanOrEqual(844 * 2);
    expect(dimensions.primaryActions).toHaveLength(2);
    expect(dimensions.primaryActions[1].top - dimensions.primaryActions[0].bottom).toBeGreaterThanOrEqual(
      844
    );
    await expect(page.locator("main > section")).toHaveCount(5);
  });

  test("sample analyze renders Candidate Brief tab", async ({ page }) => {
    await runSampleAnalyzeOnPage(page);
    const generatedReport = page.getByTestId("generated-report");
    const walkthrough = page.getByTestId("walkthrough-script").last();
    const headingOrder = await generatedReport.locator("h3, h4").allTextContents();
    const requiredOrder = [
      "Repo Summary",
      "Walkthrough Script",
      "30-second",
      "2-minute",
      "Reading Path",
      "System Flow",
      "Interview Talking Points",
    ];
    const positions = requiredOrder.map((heading) => headingOrder.indexOf(heading));
    expect(positions.every((position) => position >= 0)).toBe(true);
    expect(positions).toEqual([...positions].sort((left, right) => left - right));
    await expect(walkthrough.getByTestId("walkthrough-30-second")).toBeVisible();
    await expect(walkthrough.getByTestId("walkthrough-2-minute")).toBeVisible();
    await expect(walkthrough.getByText(/quick introduction/i)).toBeVisible();
    await expect(walkthrough.getByText(/explain the reading path/i)).toBeVisible();
    await expect(walkthrough.getByRole("button", { name: "Copy 30s" })).toBeVisible();
    await expect(walkthrough.getByRole("button", { name: "Copy 2min" })).toBeVisible();

    const hasHorizontalOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth
    );
    expect(hasHorizontalOverflow).toBe(false);
    await expect(page.getByRole("heading", { name: "Repo Summary" }).last()).toBeVisible();
    await expect(page.getByRole("heading", { name: "Reading Path" }).last()).toBeVisible();
    await expect(page.getByRole("heading", { name: "System Flow" }).last()).toBeVisible();
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
    const thirtySecond =
      (await walkthroughSection.getByTestId("walkthrough-30-second").locator("p").last().textContent()) ?? "";
    const twoMinute =
      (await walkthroughSection.getByTestId("walkthrough-2-minute").locator("p").last().textContent()) ?? "";

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
