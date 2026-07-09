import { test, expect } from "@playwright/test";
import fs from "fs";
import path from "path";
import { randomUUID } from "crypto";

const REPORTS_DIR = path.join(process.cwd(), ".playwright-reports");

test.describe("Candidate Brief smoke", () => {
  test("homepage loads with sample action", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("Candidate Brief Generator")).toBeVisible();
    await expect(
      page.getByRole("button", { name: /Try sample Candidate Brief/i })
    ).toBeVisible();
  });

  test("sample analyze renders Candidate Brief tab", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: /Try sample Candidate Brief/i }).click();
    await expect(page.getByRole("button", { name: /View report/i })).toBeVisible({
      timeout: 90_000,
    });
    await page.getByRole("button", { name: /View report/i }).click();
    await expect(page.getByRole("heading", { name: "Repo Summary" }).last()).toBeVisible();
    await expect(page.getByRole("heading", { name: "Reading Path" }).last()).toBeVisible();
  });

  test("invalid share token shows error", async ({ page }) => {
    await page.goto("/share/not-a-valid-share-token");
    await expect(page.getByText(/expired|not found/i)).toBeVisible();
  });

  test("homepage preview sample shows Candidate Brief sections", async ({ page }) => {
    await page.setViewportSize({ width: 1400, height: 1000 });
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Sample Repo" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Repo Summary" }).first()).toBeVisible();
  });

  test("sample analyze exports Markdown from Export tab", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: /Try sample Candidate Brief/i }).click();
    await expect(page.getByRole("button", { name: /View report/i })).toBeVisible({
      timeout: 90_000,
    });
    await page.getByRole("button", { name: /View report/i }).click();

    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: "Export" }).last().click();
    await page
      .getByRole("button", { name: /Export Markdown/i })
      .last()
      .click();
    const download = await downloadPromise;
    const filename = download.suggestedFilename();
    expect(filename).toMatch(/\.md$/);

    const downloadPath = await download.path();
    expect(downloadPath).toBeTruthy();
    const markdown = fs.readFileSync(downloadPath!, "utf-8");
    expect(markdown).toContain("# Repo Analysis");
    expect(markdown).toMatch(/Candidate Brief|Repo Summary/i);
  });

  test("report without candidate_brief shows fallback message", async ({ page }) => {
    fs.mkdirSync(REPORTS_DIR, { recursive: true });
    const reportId = randomUUID();
    const legacyReport = {
      repo_metadata: {
        name: "legacy-report",
        url: "zip",
        branch: "main",
        clone_hash: null,
        analyzed_at: new Date().toISOString(),
      },
      folder_map: { path: ".", type: "dir", children: [] },
      architecture: { nodes: [], edges: [] },
      start_here: [],
      danger_zones: [],
      run_commands: [],
      contribute_signals: { key_docs: [], ci_configs: [] },
      warnings: [],
    };
    fs.writeFileSync(
      path.join(REPORTS_DIR, `${reportId}.json`),
      JSON.stringify(legacyReport, null, 2)
    );

    await page.goto(`/report/${reportId}`);
    await expect(page.getByText(/Candidate Brief is not available/i).first()).toBeVisible();
  });
});
