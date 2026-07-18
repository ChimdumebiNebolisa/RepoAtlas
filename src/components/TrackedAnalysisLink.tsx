"use client";

import Link from "next/link";
import { captureProductEvent } from "@/lib/productAnalytics";

export function TrackedAnalysisLink({ children }: { children: React.ReactNode }) {
  return (
    <Link
      className="btn btn-primary interview-primary-action"
      href="/?source=interview_preparation#analyze"
      onClick={() => {
        captureProductEvent("analysis_cta_clicked", {
          source: "interview_preparation",
          destination: "analysis_start",
        });
      }}
    >
      {children} <span aria-hidden="true">→</span>
    </Link>
  );
}
