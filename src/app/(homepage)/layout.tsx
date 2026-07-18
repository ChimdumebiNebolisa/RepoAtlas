import Script from "next/script";
import {
  homepageStructuredData,
  serializeJsonLd,
} from "@/lib/homepageStructuredData";

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
