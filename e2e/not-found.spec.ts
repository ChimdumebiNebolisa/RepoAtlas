import { expect, test } from "@playwright/test";

test("unknown routes return a branded 404 with a working homepage recovery", async ({
  page,
}) => {
  const response = await page.goto("/this-page-does-not-exist");

  expect(response?.status()).toBe(404);
  await expect(page).toHaveTitle("Page not found | RepoAtlas");
  await expect(
    page.getByRole("heading", { name: "We couldn't find this page." }),
  ).toBeVisible();

  const recovery = page.getByRole("link", { name: "Return to RepoAtlas" });
  await expect(recovery).toHaveCount(1);
  await expect(recovery).toHaveAttribute("href", "/");
  await expect(page.getByRole("contentinfo")).toContainText(
    "Deterministic repository analysis. No code execution. No AI calls.",
  );

  await recovery.click();
  await expect(page).toHaveURL("/");
});

test("not-found recovery fits an exact 390-pixel viewport", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const response = await page.goto("/stale-candidate-brief-link");

  expect(response?.status()).toBe(404);
  await expect(
    page.getByRole("heading", { name: "We couldn't find this page." }),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "Return to RepoAtlas" })).toBeVisible();

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(1);
});
