import type { Metadata } from "next";
import { Manrope } from "next/font/google";
import { ProductAnalytics } from "@/components/ProductAnalytics";
import "./globals.css";

const manrope = Manrope({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "RepoAtlas - Candidate Brief Generator",
  description:
    "Generate evidence-backed Candidate Briefs and repository analysis from zip uploads. No AI required.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={manrope.className}>
        <ProductAnalytics>{children}</ProductAnalytics>
      </body>
    </html>
  );
}
