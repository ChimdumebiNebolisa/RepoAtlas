import { test, expect } from "@playwright/test";
import { VALID_UUID } from "./helpers";

test.describe("Repository input modes", () => {
  test("exposes accessible ZIP and GitHub URL tabs", async ({ page }) => {
    await page.goto("/");
    const zipTab = page.getByRole("tab", { name: "Upload ZIP" });
    const githubTab = page.getByRole("tab", { name: "Public GitHub URL" });
    await expect(zipTab).toBeVisible();
    await expect(githubTab).toBeVisible();
    await expect(zipTab).toHaveAttribute("aria-selected", "true");

    await githubTab.click();
    await expect(githubTab).toHaveAttribute("aria-selected", "true");
    await expect(page.getByLabel("Public GitHub repository URL")).toBeVisible();
    await expect(page.getByLabel(/Branch or tag/i)).toBeVisible();
  });

  test("shows a client-side validation error for a non-canonical GitHub URL", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("tab", { name: "Public GitHub URL" }).click();
    await page.getByLabel("Public GitHub repository URL").fill("https://gitlab.com/foo/bar");
    await page.getByRole("button", { name: /Analyze Repository/i }).click();
    await expect(page.locator("p.form-error")).toContainText(/canonical URL/i);
  });

  test("analyzes a valid GitHub URL (server mocked at the network boundary)", async ({ page }) => {
    // Mock the API so the e2e never depends on live GitHub.
    await page.route("**/api/analyze", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ reportId: VALID_UUID }),
      });
    });
    await page.route(`**/api/reports/${VALID_UUID}`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          report_version: 2,
          repo_metadata: {
            name: "octocat/demo",
            url: "https://github.com/octocat/demo",
            branch: "main",
            clone_hash: "a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0",
            analyzed_at: new Date().toISOString(),
          },
          folder_map: { path: ".", type: "dir", children: [] },
          architecture: { nodes: [], edges: [] },
          start_here: [],
          danger_zones: [],
          run_commands: [],
          contribute_signals: { key_docs: [], ci_configs: [] },
          warnings: [],
        }),
      });
    });

    await page.goto("/");
    await page.getByRole("tab", { name: "Public GitHub URL" }).click();
    await page.getByLabel("Public GitHub repository URL").fill("https://github.com/octocat/demo");
    await page.getByRole("button", { name: /Analyze Repository/i }).click();

    await expect(page.getByRole("button", { name: /View report/i })).toBeVisible({
      timeout: 30_000,
    });
  });
});
