import { describe, expect, it } from "vitest";
import {
  homepageFaqItems,
  homepageMetadata,
  siteIdentity,
} from "@/lib/homepageContent";
import {
  homepageStructuredData,
  serializeJsonLd,
} from "@/lib/homepageStructuredData";
import { interviewPreparationMetadata } from "@/lib/interviewPreparationContent";
import { REPORT_CAPABILITY_RULES } from "@/lib/reportCapabilities";

describe("homepage structured data", () => {
  it("keeps candidate-focused search metadata within standard result lengths", () => {
    expect(homepageMetadata.title).toBe(
      "Repository Walkthroughs for Code Interviews | RepoAtlas",
    );
    expect(homepageMetadata.title.length).toBeLessThanOrEqual(60);
    expect(homepageMetadata.description).toBe(
      "Turn a TypeScript, JavaScript, Python, or Java repository into an evidence-linked Candidate Brief with PDF and PNG exports, without running code.",
    );
    expect(homepageMetadata.description.length).toBeGreaterThanOrEqual(120);
    expect(homepageMetadata.description.length).toBeLessThanOrEqual(160);

    for (const format of REPORT_CAPABILITY_RULES.alwaysAvailableExports) {
      expect(homepageMetadata.description).toContain(format);
    }
    for (const capability of REPORT_CAPABILITY_RULES.storageDependent) {
      expect(homepageMetadata.description).not.toContain(capability);
    }
  });

  it("keeps homepage metadata distinct from the focused interview page", () => {
    expect(homepageMetadata.title).not.toBe(interviewPreparationMetadata.title);
    expect(homepageMetadata.description).not.toBe(interviewPreparationMetadata.description);
    expect(interviewPreparationMetadata.description).toBe(
      "Turn a repository into an evidence-linked Candidate Brief with likely entry points, architecture, risk signals, reading order, and talking points.",
    );
    expect(interviewPreparationMetadata.description.length).toBeLessThanOrEqual(160);
  });

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
