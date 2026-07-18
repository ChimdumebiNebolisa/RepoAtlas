import type { Metadata } from "next";
import Script from "next/script";
import { homepageMetadata } from "@/lib/homepageContent";
import {
  homepageStructuredData,
  serializeJsonLd,
} from "@/lib/homepageStructuredData";

export const metadata: Metadata = homepageMetadata;

export default function HomepageLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <>
      <Script
        id="homepage-structured-data"
        type="application/ld+json"
        strategy="beforeInteractive"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(homepageStructuredData) }}
      />
      {children}
    </>
  );
}
