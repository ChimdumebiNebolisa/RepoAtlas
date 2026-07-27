import type { CandidateBrief, EvidenceRef } from "@/types/report";
import { CandidateBriefEvidence } from "@/components/CandidateBriefEvidence";
import { CandidateBriefSection } from "@/components/CandidateBriefCoreSections";
import { EvidenceList } from "@/components/EvidenceLinks";

interface CandidateBriefSupportSectionsProps {
  candidateBrief: CandidateBrief;
  evidenceById: Map<string, EvidenceRef>;
  grouped: Record<string, CandidateBrief["evidence_refs"]>;
  usedBy: Map<string, string[]>;
  onNavigate: (id: string) => void;
  demoMode?: boolean;
}

export function CandidateBriefSupportSections({
  candidateBrief,
  evidenceById,
  grouped,
  usedBy,
  onNavigate,
  demoMode,
}: CandidateBriefSupportSectionsProps) {
  return (
    <>
      {candidateBrief.warnings.length > 0 && (
        <CandidateBriefSection title="Confidence Notes">
          <ul className="space-y-2 text-sm text-slate-700">
            {candidateBrief.warnings.map((warning, index) => (
              <li key={index} className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                {warning.message}
                {!demoMode && (
                  <EvidenceList
                    ids={warning.evidence_refs ?? []}
                    evidenceById={evidenceById}
                    onNavigate={onNavigate}
                  />
                )}
              </li>
            ))}
          </ul>
        </CandidateBriefSection>
      )}

      {!demoMode && <CandidateBriefEvidence grouped={grouped} usedBy={usedBy} />}

      <p className="text-xs text-slate-500">
        RepoAtlas does not execute uploaded code. Claims are limited to detected static signals.
      </p>
    </>
  );
}
