import { test, expect } from "@playwright/test";
import fs from "fs";
import { randomUUID } from "crypto";
import {
  REPORT_TABS,
  expectCompletedReportInViewport,
  legacyReportWithoutBrief,
  runSampleAnalyzeOnPage,
  writeReport,
} from "./helpers";

test.describe("Candidate Brief smoke", () => {
  for (const viewport of [
    { label: "desktop", width: 1440, height: 900 },
    { label: "390px mobile", width: 390, height: 844 },
  ]) {
    test(`homepage hero opens the complete bundled sample by keyboard on ${viewport.label}`, async ({
      page,
    }) => {
      const browserDiagnostics: string[] = [];
      page.on("console", (message) => {
        if (["error", "warning"].includes(message.type())) {
          browserDiagnostics.push(`${message.type()}: ${message.text()}`);
        }
      });
      page.on("pageerror", (error) => {
        browserDiagnostics.push(`pageerror: ${error.message}`);
      });
      page.on("response", (response) => {
        if (
          response.status() >= 400 &&
          ["document", "fetch", "xhr"].includes(response.request().resourceType())
        ) {
          browserDiagnostics.push(
            `HTTP ${response.status()}: ${response.request().method()} ${response.url()}`
          );
        }
      });

      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.goto("/");
      const hero = page.locator(".hero");

      await expect(
        hero.getByRole("heading", {
          name: "Turn a repository into an interview-ready brief.",
        })
      ).toBeVisible();
      await expect(hero.locator("p")).toHaveCount(0);
      await expect(hero.locator(".btn-primary")).toHaveCount(1);
      await expect(hero.getByRole("link")).toHaveCount(0);

      const sampleAction = hero.getByRole("button", {
        name: /Open the sample Candidate Brief/i,
      });
      await page
        .locator("#analyze summary")
        .filter({ hasText: "Use a different conversation focus" })
        .click();
      await page.getByRole("radio", { name: /Investigate a bug/i }).check();
      await sampleAction.focus();
      await expect(sampleAction).toBeFocused();
      await page.keyboard.press("Enter");
      await expectCompletedReportInViewport(page);

      const repositoryNextStep = page.locator(".report-sample-next-step");
      const usefulnessPrompt = page.locator(".report-usefulness-prompt");
      await expect(
        repositoryNextStep.getByRole("heading", {
          name: "Now map a repository you need to explain.",
        })
      ).toBeVisible();
      const repositoryAction = repositoryNextStep.getByRole("button", {
        name: "Analyze my public GitHub repository",
      });
      await expect(repositoryAction).toBeVisible();
      await expect(repositoryNextStep.getByRole("button")).toHaveCount(1);
      await expect(usefulnessPrompt).toBeVisible();
      expect(
        await repositoryNextStep.evaluate((nextStep, usefulness) =>
          Boolean(
            usefulness &&
              nextStep.compareDocumentPosition(usefulness) &
                Node.DOCUMENT_POSITION_FOLLOWING
          ), await usefulnessPrompt.elementHandle())
      ).toBe(true);

      await repositoryAction.click();
      await expect(page.getByRole("tab", { name: "Public GitHub URL" })).toHaveAttribute(
        "aria-selected",
        "true"
      );
      await expect(page.getByLabel("Public GitHub repository URL")).toBeFocused();
      await expect(
        page.getByRole("radio", { name: /Prepare for an interview/i })
      ).toBeChecked();
      await expect(
        page.getByRole("radio", { name: /Investigate a bug/i, includeHidden: true })
      ).not.toBeVisible();

      for (const tabName of REPORT_TABS) {
        await expect(
          page.getByRole("tab", { name: tabName, exact: true }).last()
        ).toBeVisible();
      }

      const dimensions = await page.evaluate(() => ({
        documentWidth: document.documentElement.scrollWidth,
        viewportWidth: window.innerWidth,
      }));
      expect(dimensions.documentWidth).toBeLessThanOrEqual(dimensions.viewportWidth);
      expect(browserDiagnostics).toEqual([]);
    });
  }

  test("homepage keeps the sample as its one dominant starting action", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/");

    const hero = page.locator(".hero");
    await expect(
      hero.getByRole("heading", {
        name: "Turn a repository into an interview-ready brief.",
      })
    ).toBeVisible();
    await expect(hero.locator(".btn-primary")).toHaveCount(1);
    await expect(hero.getByRole("link")).toHaveCount(0);
    await expect(page.locator("main .btn-primary")).toHaveCount(1);
    await expect(page.getByTestId("walkthrough-outcomes")).toHaveCount(0);
    await expect(page.getByTestId("homepage-sample-preview")).toHaveCount(0);
    await expect(
      page.getByRole("navigation", { name: "Prepare to explain a repository." })
    ).toHaveCount(0);
    await expect(
      page.getByRole("heading", { name: "Analyze your repository." })
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "How RepoAtlas treats your code." })
    ).toBeVisible();
    const galleryLink = page
      .locator(".analysis-intent-fieldset")
      .getByRole("link", { name: "Compare four exact-commit Candidate Briefs" });
    await expect(galleryLink).toHaveAttribute("href", "/examples");
    await expect(galleryLink).not.toHaveClass(/btn-primary/);
    await expect(page.locator("main > section")).toHaveCount(3);

    const pageShape = await page.evaluate(() => ({
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    }));
    expect(pageShape.overflow).toBeLessThanOrEqual(0);
  });

  test("the sample remains the only first-screen action at exactly 390 by 844", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");

    await expect(
      page.getByRole("heading", {
        name: "Turn a repository into an interview-ready brief.",
      })
    ).toBeVisible();

    const dimensions = await page.evaluate(() => ({
      documentWidth: document.documentElement.scrollWidth,
      viewportWidth: window.innerWidth,
      analysisTop: document.querySelector("#analyze")?.getBoundingClientRect().top ?? 0,
      primaryActions: Array.from(document.querySelectorAll<HTMLElement>("main .btn-primary")).map(
        (element) => ({
          top: element.getBoundingClientRect().top,
          bottom: element.getBoundingClientRect().bottom,
        })
      ),
    }));
    expect(dimensions.documentWidth).toBeLessThanOrEqual(dimensions.viewportWidth);
    expect(dimensions.primaryActions).toHaveLength(1);
    expect(dimensions.primaryActions[0].bottom).toBeLessThanOrEqual(844);
    expect(dimensions.analysisTop).toBeGreaterThanOrEqual(844);
    await expect(page.locator("main > section")).toHaveCount(3);
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
