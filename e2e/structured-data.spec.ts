import { expect, test } from "@playwright/test";

test("homepage exposes synchronized Product and FAQPage JSON-LD in the head", async ({ page }) => {
  await page.goto("/");

  const jsonLd = page.locator('head script#homepage-structured-data[type="application/ld+json"]');
  await expect(jsonLd).toHaveCount(1);

  const structuredData = JSON.parse((await jsonLd.textContent()) ?? "null") as {
    "@context": string;
    "@graph": Array<Record<string, unknown>>;
  };
  expect(structuredData["@context"]).toBe("https://schema.org");

  const product = structuredData["@graph"].find((item) => item["@type"] === "Product");
  expect(product).toEqual({
    "@type": "Product",
    name: "RepoAtlas",
    description:
      "Generate evidence-backed Candidate Briefs and repository analysis from ZIP uploads. No AI required.",
    url: "https://repo-atlas-phi.vercel.app/",
  });

  const faqPage = structuredData["@graph"].find((item) => item["@type"] === "FAQPage") as {
    mainEntity: Array<{ name: string; acceptedAnswer: { text: string } }>;
  };
  const visibleFaq = await page.getByTestId("homepage-faq-item").evaluateAll((items) =>
    items.map((item) => ({
      name: item.querySelector("h3")?.textContent?.trim(),
      text: item.querySelector("p")?.textContent?.trim(),
    })),
  );

  expect(faqPage.mainEntity).toHaveLength(5);
  expect(
    faqPage.mainEntity.map(({ name, acceptedAnswer }) => ({
      name,
      text: acceptedAnswer.text,
    })),
  ).toEqual(visibleFaq);
});

test("homepage structured data does not leak onto trust pages", async ({ page }) => {
  await page.goto("/privacy");
  await expect(page.locator('script[type="application/ld+json"]')).toHaveCount(0);
});
