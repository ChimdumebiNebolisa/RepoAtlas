import type { EvidenceRef } from "@/types/report";

function EvidenceBadge({
  id,
  evidenceById,
  onNavigate,
  demoMode,
}: {
  id: string;
  evidenceById: Map<string, EvidenceRef>;
  onNavigate?: (id: string) => void;
  demoMode?: boolean;
}) {
  const evidence = evidenceById.get(id);
  const tooltip = [evidence?.label, evidence?.path, evidence?.detail, evidence?.snippet]
    .filter(Boolean)
    .join(" — ");

  return (
    <button
      type="button"
      onClick={() => onNavigate?.(id)}
      title={tooltip || id}
      className="report-action report-action-secondary report-action-compact max-w-full font-mono"
    >
      {demoMode ? "evidence" : id}
    </button>
  );
}

export function EvidenceList({
  ids,
  evidenceById,
  onNavigate,
  demoMode,
}: {
  ids: string[];
  evidenceById: Map<string, EvidenceRef>;
  onNavigate?: (id: string) => void;
  demoMode?: boolean;
}) {
  const uniqueIds = Array.from(new Set(ids)).filter((id) => evidenceById.has(id));
  if (uniqueIds.length === 0) return null;

  return (
    <div className="mt-3 flex flex-wrap gap-1.5">
      {uniqueIds.map((id) => (
        <EvidenceBadge
          key={id}
          id={id}
          evidenceById={evidenceById}
          onNavigate={onNavigate}
          demoMode={demoMode}
        />
      ))}
    </div>
  );
}
