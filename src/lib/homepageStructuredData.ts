import { homepageFaqItems, siteIdentity } from "@/lib/homepageContent";

export const homepageStructuredData = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Product",
      name: siteIdentity.name,
      description: siteIdentity.description,
      url: siteIdentity.url,
    },
    {
      "@type": "FAQPage",
      mainEntity: homepageFaqItems.map(({ question, answer }) => ({
        "@type": "Question",
        name: question,
        acceptedAnswer: {
          "@type": "Answer",
          text: answer,
        },
      })),
    },
  ],
} as const;

export function serializeJsonLd(data: unknown): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}
