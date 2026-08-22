"use client";

import { useMemo } from "react";
import type { CandidateBrief } from "@/types/report";
import { CandidateBriefCoreSections } from "@/components/CandidateBriefCoreSections";
import { CandidateBriefPreparationSections } from "@/components/CandidateBriefPreparationSections";
import { CandidateBriefSupportSections } from "@/components/CandidateBriefSupportSections";
import { buildEvidenceUsedByIndex, groupEvidenceByKind } from "@/lib/evidenceIndex";
import type { ReportVariant } from "@/lib/productAnalytics";

interface CandidateBriefPanelProps {
  candidateBrief?: CandidateBrief;
  demoMode?: boolean;
  reportVariant?: ReportVariant;
  sourceBaseUrl?: string;
}

export function CandidateBriefPanel({
  candidateBrief,
  demoMode,
  reportVariant = "live",
  sourceBaseUrl,
}: CandidateBriefPanelProps) {
  const usedBy = useMemo(
    () => (candidateBrief ? buildEvidenceUsedByIndex(candidateBrief) : new Map()),
    [candidateBrief]
  );
  const grouped = useMemo(
    () =>
      candidateBrief
        ? groupEvidenceByKind(candidateBrief.evidence_refs)
        : ({} as ReturnType<typeof groupEvidenceByKind>),
    [candidateBrief]
  );

  const scrollToEvidence = (id: string) => {
    const element = document.getElementById(`evidence-${id}`);
    element?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  if (!candidateBrief) {
    return (
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
        Candidate Brief is not available for this report. Re-run analysis with the latest analyzer,
        or check whether the repository has supported source files, docs, and run commands.
      </div>
    );
  }

  const evidenceById = new Map(candidateBrief.evidence_refs.map((ref) => [ref.id, ref]));

  return (
    <div className={`space-y-4 ${demoMode ? "text-[15px]" : ""}`}>
      <CandidateBriefCoreSections
        candidateBrief={candidateBrief}
        evidenceById={evidenceById}
        onNavigate={scrollToEvidence}
        demoMode={demoMode}
        reportVariant={reportVariant}
      />
      <CandidateBriefPreparationSections
        candidateBrief={candidateBrief}
        evidenceById={evidenceById}
        onNavigate={scrollToEvidence}
        demoMode={demoMode}
      />
      <CandidateBriefSupportSections
        candidateBrief={candidateBrief}
        evidenceById={evidenceById}
        grouped={grouped}
        usedBy={usedBy}
        onNavigate={scrollToEvidence}
        demoMode={demoMode}
        sourceBaseUrl={sourceBaseUrl}
      />
    </div>
  );
}
