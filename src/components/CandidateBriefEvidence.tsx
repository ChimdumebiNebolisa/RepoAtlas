import type { EvidenceRef } from "@/types/report";

interface CandidateBriefEvidenceProps {
  grouped: Record<string, EvidenceRef[]>;
  usedBy: Map<string, string[]>;
}

export function CandidateBriefEvidence({ grouped, usedBy }: CandidateBriefEvidenceProps) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4">
      <h3 className="text-base font-semibold text-slate-900">Evidence</h3>
      <p className="mt-1 text-xs text-slate-500">
        Every claim above links back to these detected signals.
      </p>
      <div className="mt-3 space-y-4">
        {Object.entries(grouped).map(([kind, refs]) => (
          <div key={kind}>
            <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              {kind}
            </h4>
            <div className="mt-2 grid gap-2 md:grid-cols-2">
              {refs.map((ref) => {
                const usageLabels = usedBy.get(ref.id) ?? [];

                return (
                  <div
                    key={ref.id}
                    id={`evidence-${ref.id}`}
                    className="scroll-mt-24 rounded-lg border border-slate-200 bg-slate-50 p-3"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <code className="rounded bg-white px-2 py-1 text-xs text-slate-900">
                        {ref.id}
                      </code>
                    </div>
                    <p className="mt-2 text-sm font-medium text-slate-900">{ref.label}</p>
                    {ref.path && (
                      <p className="mt-1 font-mono text-xs text-slate-600">
                        {ref.path}
                        {ref.line_start ? `:${ref.line_start}` : ""}
                      </p>
                    )}
                    {ref.detail && (
                      <p className="mt-2 text-xs text-slate-600">{ref.detail}</p>
                    )}
                    {ref.snippet && (
                      <pre className="mt-2 overflow-x-auto rounded bg-white p-2 text-xs text-slate-700">
                        {ref.snippet}
                      </pre>
                    )}
                    {usageLabels.length > 0 && (
                      <p className="mt-2 text-xs text-slate-500">
                        Used by: {usageLabels.join(", ")}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
