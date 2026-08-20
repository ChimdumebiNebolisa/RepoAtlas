import type { Metadata } from "next";
import { SiteHeader } from "@/components/SiteHeader";
import { analyzeBundledSample } from "@/lib/bundledSample";
import { buildHomepageSamplePreview } from "@/lib/homepageSamplePreview";
import { AiSummaryActions } from "./AiSummaryActions";
import { AiSummaryComparison } from "./AiSummaryComparison";
import { AiSummaryProof } from "./AiSummaryProof";
import { AiSummaryTraceability } from "./AiSummaryTraceability";

const canonicalUrl = "https://repo-atlas-phi.vercel.app/ai-codebase-summary";

const title = "AI Codebase Summary vs. Evidence-Linked Brief | RepoAtlas";
const description =
  "Compare an AI codebase summary with a file-backed Candidate Brief for interviews, including source traceability, architecture, risks, tests, and limits.";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: canonicalUrl },
  openGraph: {
    title,
    description,
    type: "article",
    url: canonicalUrl,
  },
};

export default async function AiCodebaseSummaryPage() {
  const { report } = await analyzeBundledSample();
  const sample = buildHomepageSamplePreview(report);

  return (
    <main className="site-shell guide-page comparison-page ai-summary-page">
      <div className="site-grid" aria-hidden="true" />
      <SiteHeader />

      <article>
        <AiSummaryComparison sample={sample} />
        <AiSummaryTraceability />
        <AiSummaryProof />
        <AiSummaryActions />
      </article>
    </main>
  );
}
