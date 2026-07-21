import { test, expect } from "@playwright/test";
import { expectCompletedReportInViewport, VALID_UUID } from "./helpers";

interface RepositoryFailure {
  name: string;
  status: number;
  code: string;
  message: string;
  expected: RegExp;
  retryAfter?: string;
  ref?: string;
}

const repositoryFailures: RepositoryFailure[] = [
  {
    name: "GitHub rate limit",
    status: 429,
    code: "RATE_LIMITED",
    message: "GitHub rate limit reached while fetching this repository. Please try again later.",
    retryAfter: "60",
    expected: /RATE_LIMITED:.*Retry in 60 seconds/i,
  },
  {
    name: "analysis timeout",
    status: 504,
    code: "TIMEOUT",
    message:
      "Analysis timed out. The repo may be too large or complex. Try a smaller repo or a specific branch.",
    expected: /TIMEOUT:.*Try a smaller repo or a specific branch/i,
  },
  {
    name: "private or missing repository",
    status: 404,
    code: "REPO_NOT_FOUND",
    message:
      "Repository not found or private. Check the owner and repository name, or upload a permitted ZIP instead.",
    expected: /REPO_NOT_FOUND:.*not found or private.*upload a permitted ZIP/i,
  },
  {
    name: "invalid ref",
    status: 404,
    code: "MISSING_REF",
    message: "The requested branch or tag was not found in this repository.",
    ref: "missing-branch",
    expected: /MISSING_REF:.*branch or tag was not found/i,
  },
];

test.describe("Repository input modes", () => {
  test("exposes accessible ZIP and GitHub URL tabs", async ({ page }) => {
    await page.goto("/");
    const zipTab = page.getByRole("tab", { name: "Upload ZIP" });
    const githubTab = page.getByRole("tab", { name: "Public GitHub URL" });
    await expect(zipTab).toBeVisible();
    await expect(githubTab).toBeVisible();
    await expect(githubTab).toHaveAttribute("aria-selected", "true");
    await expect(page.getByLabel("Public GitHub repository URL")).toBeVisible();
    await expect(page.getByLabel(/Branch or tag/i)).toBeVisible();
    await expect(page.getByRole("radio", { name: /Interview walkthrough/i })).toBeChecked();
    await expect(page.getByRole("radio", { name: /Investigate a bug/i })).toBeVisible();
    await expect(page.getByRole("radio", { name: /Plan a change/i })).toBeVisible();
    await expect(page.getByRole("radio", { name: /Discuss a pull request/i })).toBeVisible();
  });

  test("shows a client-side validation error for a non-canonical GitHub URL", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("tab", { name: "Public GitHub URL" }).click();
    await page.getByLabel("Public GitHub repository URL").fill("https://gitlab.com/foo/bar");
    await page.getByRole("button", { name: /Analyze public GitHub repository/i }).click();
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
    await page.getByRole("button", { name: /Analyze public GitHub repository/i }).click();

    await expectCompletedReportInViewport(page);
  });

  for (const failure of repositoryFailures) {
    test(`shows a clear recovery action for ${failure.name}`, async ({ page }) => {
      await page.route("**/api/analyze", async (route) => {
        await route.fulfill({
          status: failure.status,
          contentType: "application/json",
          headers: failure.retryAfter ? { "Retry-After": failure.retryAfter } : undefined,
          body: JSON.stringify({
            code: failure.code,
            message: failure.message,
            requestId: VALID_UUID,
          }),
        });
      });

      await page.goto("/", { waitUntil: "networkidle" });
      const githubUrlInput = page.getByLabel("Public GitHub repository URL");
      await githubUrlInput.fill("https://github.com/octocat/demo");
      await expect(githubUrlInput).toHaveValue("https://github.com/octocat/demo");
      if (failure.ref) {
        const githubRefInput = page.getByLabel(/Branch or tag/i);
        await githubRefInput.fill(failure.ref);
        await expect(githubRefInput).toHaveValue(failure.ref);
      }
      const analyzeButton = page.getByRole("button", {
        name: /Analyze public GitHub repository/i,
      });
      await analyzeButton.click();

      await expect(page.locator(".analyze-card .form-error")).toContainText(failure.expected);
      await expect(analyzeButton).toBeEnabled();
    });
  }

  test("rejects an oversized archive locally and keeps the form retryable", async ({ page }) => {
    let analyzeRequests = 0;
    await page.route("**/api/analyze", async (route) => {
      analyzeRequests += 1;
      await route.abort();
    });

    await page.goto("/");
    await page.getByRole("tab", { name: "Upload ZIP" }).click();
    await page.getByLabel("Choose repository zip file").setInputFiles({
      name: "oversized.zip",
      mimeType: "application/zip",
      buffer: Buffer.alloc(4 * 1024 * 1024 + 1),
    });

    await expect(page.locator("#input-form-error")).toContainText(/4MB or smaller/i);
    await expect(page.getByRole("button", { name: /Analyze uploaded ZIP/i })).toBeEnabled();
    expect(analyzeRequests).toBe(0);
  });
});
