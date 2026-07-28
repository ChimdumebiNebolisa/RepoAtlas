"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  analysisEntrySourceValue,
  cycleThreeSourceToken,
  type AnalysisEntrySource,
} from "@/lib/analysisAttribution";
import { captureProductEvent } from "@/lib/productAnalytics";

type TrackedAnalysisLinkProps = {
  children: React.ReactNode;
  className?: string;
  entrySource?: AnalysisEntrySource;
};

type AnalysisLinkProps = TrackedAnalysisLinkProps & {
  entrySource: AnalysisEntrySource | undefined;
};

function AnalysisLink({
  children,
  className = "interview-primary-action",
  entrySource,
}: AnalysisLinkProps) {
  const source = entrySource ?? "interview_preparation";

  return (
    <Link
      className={`btn btn-primary ${className}`}
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

function SearchAttributedAnalysisLink(
  props: Omit<TrackedAnalysisLinkProps, "entrySource">
) {
  const searchParams = useSearchParams();
  const entrySource = cycleThreeSourceToken(searchParams.get("source"));

  return <AnalysisLink {...props} entrySource={entrySource} />;
}

export function TrackedAnalysisLink({
  entrySource,
  ...props
}: TrackedAnalysisLinkProps) {
  if (entrySource !== undefined) {
    return (
      <AnalysisLink
        {...props}
        entrySource={analysisEntrySourceValue(entrySource)}
      />
    );
  }

  return <SearchAttributedAnalysisLink {...props} />;
}
