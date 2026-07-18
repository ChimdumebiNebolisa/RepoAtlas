import type { Metadata } from "next";
import { Manrope } from "next/font/google";
import { ProductAnalytics } from "@/components/ProductAnalytics";
import { SiteFooter } from "@/components/SiteFooter";
import { siteIdentity } from "@/lib/homepageContent";
import "./globals.css";

const manrope = Manrope({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "RepoAtlas - Candidate Brief Generator",
  description: siteIdentity.description,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${manrope.className} site-body`}>
        <ProductAnalytics>{children}</ProductAnalytics>
        <SiteFooter />
      </body>
    </html>
  );
}
