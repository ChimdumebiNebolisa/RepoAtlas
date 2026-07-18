import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Shared Candidate Brief | RepoAtlas",
  robots: { index: false, follow: false },
};

export default function SharedReportLayout({ children }: { children: React.ReactNode }) {
  return children;
}
