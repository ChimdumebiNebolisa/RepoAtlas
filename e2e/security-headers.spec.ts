import { expect, test } from "@playwright/test";

test("production pages expose the tested security policy", async ({ request }) => {
  const response = await request.get("/");
  expect(response.ok()).toBeTruthy();

  const headers = response.headers();
  expect(headers["x-content-type-options"]).toBe("nosniff");
  expect(headers["x-frame-options"]).toBe("SAMEORIGIN");
  expect(headers["referrer-policy"]).toBe("strict-origin-when-cross-origin");
  expect(headers["strict-transport-security"]).toContain("max-age=63072000");

  const csp = headers["content-security-policy"];
  expect(csp).toContain("default-src 'self'");
  expect(csp).toContain("connect-src 'self'");
  expect(csp).toContain("img-src 'self' data: blob:");
  expect(csp).toContain("object-src 'none'");
  expect(csp).toContain("frame-src 'none'");
  expect(csp).not.toContain("unsafe-eval");
});

test("production CSP permits the client report PDF export", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /^Open sample report/i }).first().click();
  await expect(page.getByRole("heading", { name: "Repo Summary" }).first()).toBeVisible({
    timeout: 30_000,
  });

  const downloadPromise = page.waitForEvent("download", { timeout: 60_000 });
  await page.getByRole("button", { name: "Export PDF" }).first().click();
  const download = await downloadPromise;

  expect(download.suggestedFilename()).toMatch(/\.pdf$/);
  expect(await download.path()).toBeTruthy();
});
