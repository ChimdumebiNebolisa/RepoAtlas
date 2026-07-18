import { expect, test } from "@playwright/test";

test("interview-preparation page leads to the measurable analysis start", async ({ page }) => {
  await page.goto("/interview-preparation");

  await expect(page).toHaveTitle(/Code Interview Preparation with a Candidate Brief/);
  await expect(
    page.getByRole("heading", { name: "Prepare to explain your code, file by file." })
  ).toBeVisible();
  await expect(page.getByText("Walk me through this repository.")).toBeVisible();

  const primaryAction = page.getByRole("link", { name: "Prepare my Candidate Brief" });
  await expect(primaryAction).toHaveAttribute(
    "href",
    "/?source=interview_preparation#analyze"
  );
  await primaryAction.click();

  await expect(page).toHaveURL(/\?source=interview_preparation#analyze$/);
  await expect(page.getByRole("heading", { name: "Start with the sample or a public GitHub repository." })).toBeVisible();
});
