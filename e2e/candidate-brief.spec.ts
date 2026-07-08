import { test, expect } from "@playwright/test";

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
});
