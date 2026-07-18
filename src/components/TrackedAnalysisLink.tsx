"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { cycleThreeSourceToken } from "@/lib/analysisAttribution";
import { captureProductEvent } from "@/lib/productAnalytics";

export function TrackedAnalysisLink({ children }: { children: React.ReactNode }) {
  const searchParams = useSearchParams();
  const entrySource = cycleThreeSourceToken(searchParams.get("source"));
  const source = entrySource ?? "interview_preparation";

  return (
    <Link
      className="btn btn-primary interview-primary-action"
      href={`/?source=${source}#analyze`}
      onClick={() => {
        captureProductEvent("analysis_cta_clicked", {
          source: "interview_preparation",
          destination: "analysis_start",
          ...(entrySource ? { entry_source: entrySource } : {}),
        });
      }}
    >
      {children} <span aria-hidden="true">→</span>
    </Link>
  );
}
