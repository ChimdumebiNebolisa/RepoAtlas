import { expect, test } from "@playwright/test";

test("interview-preparation page leads to the measurable analysis start", async ({ page }) => {
  await page.goto("/interview-preparation");

  await expect(page).toHaveTitle(/Code Interview Preparation with a Candidate Brief/);
  await expect(
    page.getByRole("heading", { name: "Prepare to explain your code, file by file." })
  ).toBeVisible();
  await expect(page.getByText("Walk me through this repository.")).toBeVisible();
  for (const output of ["Entry points", "Architecture", "Risk signals", "Reading order"]) {
    await expect(page.getByRole("heading", { name: output })).toBeVisible();
  }
  await expect(page.getByText(/PDF and PNG exports/)).toBeVisible();
  await expect(page.getByText(/7-day encrypted browser sharing/)).toBeVisible();
  await expect(page.getByText(/Markdown and saved server links require saved report storage/)).toBeVisible();
  await expect(page.getByText(/Deeper TypeScript\/JavaScript, Python, and Java analysis/)).toBeVisible();
  await expect(page.getByText(/without executing code or calling AI/)).toBeVisible();

  const primaryAction = page.getByRole("link", { name: "Prepare my Candidate Brief" });
  await expect(primaryAction).toHaveAttribute(
    "href",
    "/?source=interview_preparation#analyze"
  );
  await primaryAction.click();

  await expect(page).toHaveURL(/\?source=interview_preparation#analyze$/);
  await expect(
    page.getByRole("heading", { name: "Start with the sample or your repository." })
  ).toBeVisible();
});

test("repository walkthrough guide teaches the method and opens the bundled sample path", async ({ page }) => {
  await page.goto("/repository-walkthrough-interview");

  await expect(page).toHaveTitle(/Repository Walkthrough Interview Guide/);
  await expect(
    page.getByRole("heading", { name: "How to walk an interviewer through a repository." })
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Use a reading order you can explain." })
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Trace responsibility, not every dependency." })
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: "Label what you know." })).toBeVisible();
  await expect(page.getByText("Observed", { exact: true })).toBeVisible();
  await expect(page.getByText("Inferred", { exact: true })).toBeVisible();
  await expect(page.getByText("Unknown", { exact: true })).toBeVisible();
  await expect(page.getByText(/does not execute code or call AI/)).toBeVisible();
  await expect(page.getByText(/TypeScript\/JavaScript, Python, and Java/)).toBeVisible();

  const primaryAction = page.getByRole("link", { name: "Run the bundled sample" });
  await expect(primaryAction).toHaveCount(1);
  await expect(primaryAction).toHaveAttribute(
    "href",
    "/?source=interview_preparation#analyze"
  );
  await primaryAction.click();

  await expect(page).toHaveURL(/\?source=interview_preparation#analyze$/);
  await expect(
    page.getByRole("heading", { name: "Start with the sample or your repository." })
  ).toBeVisible();
  await page.getByRole("button", { name: /Generate sample Candidate Brief/i }).click();
  await expect(page.getByTestId("completed-report-heading")).toBeVisible({ timeout: 90_000 });
});

test("repository walkthrough guide fits a narrow mobile viewport", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/repository-walkthrough-interview");

  await expect(
    page.getByRole("heading", { name: "How to walk an interviewer through a repository." })
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "Run the bundled sample" })).toBeVisible();

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth
  );
  expect(overflow).toBeLessThanOrEqual(1);
});

test("repository walkthrough guide is included in the sitemap", async ({ request }) => {
  const response = await request.get("/sitemap.xml");

  expect(response.ok()).toBe(true);
  await expect(response.text()).resolves.toContain("/repository-walkthrough-interview");
});
