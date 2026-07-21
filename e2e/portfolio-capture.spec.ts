import fs from "fs";
import path from "path";
import { test, expect } from "@playwright/test";
import { expectCompletedReportInViewport } from "./helpers";

const IMAGES_DIR = path.join(process.cwd(), "docs", "images");

test.describe("Portfolio capture", () => {
  test("capture landing and Candidate Brief screenshots", async ({ page }) => {
    fs.mkdirSync(IMAGES_DIR, { recursive: true });

    await page.goto("/");
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.screenshot({ path: path.join(IMAGES_DIR, "landing.png"), fullPage: true });

    await page.getByRole("button", { name: /Try sample Candidate Brief/i }).click();
    await expectCompletedReportInViewport(page);
    await expect(page.getByRole("heading", { name: "Repo Summary" }).last()).toBeVisible();

    await page.screenshot({
      path: path.join(IMAGES_DIR, "candidate-brief.png"),
      fullPage: true,
    });

    await page.getByRole("heading", { name: "Reading Path" }).last().scrollIntoViewIfNeeded();
    await page.screenshot({
      path: path.join(IMAGES_DIR, "reading-path.png"),
      fullPage: true,
    });

    await page.getByRole("heading", { name: "First PR Plan" }).last().scrollIntoViewIfNeeded();
    await page.screenshot({
      path: path.join(IMAGES_DIR, "first-pr-plan.png"),
      fullPage: true,
    });

    await page.getByRole("tab", { name: "Export" }).last().click();
    await page.screenshot({
      path: path.join(IMAGES_DIR, "export-tab.png"),
      fullPage: true,
    });
  });
});
