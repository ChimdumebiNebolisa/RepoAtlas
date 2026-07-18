import { describe, expect, it } from "vitest";
import { homepageFaqItems, siteIdentity } from "@/lib/homepageContent";
import {
  homepageStructuredData,
  serializeJsonLd,
} from "@/lib/homepageStructuredData";

describe("homepage structured data", () => {
  it("describes RepoAtlas without commercial or unsupported claims", () => {
    const product = homepageStructuredData["@graph"][0];

    expect(product).toEqual({
      "@type": "Product",
      name: siteIdentity.name,
      description: siteIdentity.description,
      url: siteIdentity.url,
    });
    expect(product).not.toHaveProperty("offers");
    expect(product).not.toHaveProperty("review");
    expect(product).not.toHaveProperty("aggregateRating");
  });

  it("mirrors every visible FAQ question and answer", () => {
    const faqPage = homepageStructuredData["@graph"][1];

    expect(faqPage["@type"]).toBe("FAQPage");
    expect(faqPage.mainEntity).toHaveLength(5);
    expect(faqPage.mainEntity).toEqual(
      homepageFaqItems.map(({ question, answer }) => ({
        "@type": "Question",
        name: question,
        acceptedAnswer: { "@type": "Answer", text: answer },
      })),
    );
  });

  it("serializes valid JSON and escapes HTML opening brackets", () => {
    const serialized = serializeJsonLd({ value: "</script><script>" });

    expect(serialized).not.toContain("<");
    expect(JSON.parse(serialized)).toEqual({ value: "</script><script>" });
  });
});
