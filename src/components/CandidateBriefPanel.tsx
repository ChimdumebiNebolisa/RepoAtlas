"use client";

import type { BriefAnswer, CandidateBrief, EvidenceRef } from "@/types/report";

interface CandidateBriefPanelProps {
  candidateBrief?: CandidateBrief;
}

function confidenceClass(confidence: "high" | "medium" | "low") {
  if (confidence === "high") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (confidence === "medium") return "border-amber-200 bg-amber-50 text-amber-700";
  return "border-slate-200 bg-slate-50 text-slate-600";
}

function EvidenceBadge({ id, evidenceById }: { id: string; evidenceById: Map<string, EvidenceRef> }) {
  const evidence = evidenceById.get(id);
  return (
    <span
      title={evidence?.detail ?? evidence?.label ?? id}
      className="inline-flex max-w-full items-center rounded-md border border-slate-200 bg-white px-2 py-1 font-mono text-[11px] text-slate-600"
    >
      {id}
    </span>
  );
}

function EvidenceList({
  ids,
  evidenceById,
}: {
  ids: string[];
  evidenceById: Map<string, EvidenceRef>;
}) {
  const uniqueIds = Array.from(new Set(ids)).filter((id) => evidenceById.has(id));
  if (uniqueIds.length === 0) return null;

  return (
    <div className="mt-3 flex flex-wrap gap-1.5">
      {uniqueIds.map((id) => (
        <EvidenceBadge key={id} id={id} evidenceById={evidenceById} />
      ))}
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4">
      <h3 className="text-base font-semibold text-slate-900">{title}</h3>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function TalkingPoint({
  title,
  answer,
  evidenceById,
}: {
  title: string;
  answer: BriefAnswer;
  evidenceById: Map<string, EvidenceRef>;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <h4 className="text-sm font-semibold text-slate-900">{title}</h4>
        <span
          className={`rounded-full border px-2 py-0.5 text-xs ${confidenceClass(answer.confidence)}`}
        >
          {answer.confidence} confidence
        </span>
      </div>
      <p className="mt-2 text-sm leading-6 text-slate-700">{answer.answer}</p>
      {answer.bullets.length > 0 && (
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-700">
          {answer.bullets.map((bullet, index) => (
            <li key={index}>{bullet}</li>
          ))}
        </ul>
      )}
      <EvidenceList ids={answer.evidence_refs} evidenceById={evidenceById} />
    </div>
  );
}

export function CandidateBriefPanel({ candidateBrief }: CandidateBriefPanelProps) {
  if (!candidateBrief) {
    return (
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
        Candidate Brief is not available for this report. Re-run analysis to generate
        interview-mode output.
      </div>
    );
  }

  const evidenceById = new Map(candidateBrief.evidence_refs.map((ref) => [ref.id, ref]));
  const talkingPoints = candidateBrief.interview_talking_points;

  return (
    <div className="space-y-4">
      <Section title="Repo Summary">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">
              {candidateBrief.repo_summary.headline}
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-700">
              {candidateBrief.repo_summary.plain_english}
            </p>
          </div>
          <span
            className={`rounded-full border px-2.5 py-1 text-xs ${confidenceClass(
              candidateBrief.repo_summary.confidence
            )}`}
          >
            {candidateBrief.repo_summary.confidence} confidence
          </span>
        </div>
        <EvidenceList
          ids={candidateBrief.repo_summary.primary_evidence}
          evidenceById={evidenceById}
        />
      </Section>

      <Section title="Reading Path">
        {candidateBrief.reading_path.length === 0 ? (
          <p className="text-sm text-slate-600">No ranked reading path was generated.</p>
        ) : (
          <ol className="space-y-3">
            {candidateBrief.reading_path.map((item) => (
              <li key={`${item.order}-${item.path}`} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-emerald-700 text-xs font-semibold text-white">
                    {item.order}
                  </span>
                  <code className="rounded bg-white px-2 py-1 text-xs text-slate-900">
                    {item.path}
                  </code>
                </div>
                <p className="mt-2 text-sm text-slate-700">{item.why}</p>
                <EvidenceList ids={item.evidence_refs} evidenceById={evidenceById} />
              </li>
            ))}
          </ol>
        )}
      </Section>

      <Section title="Interview Talking Points">
        <div className="grid gap-3 lg:grid-cols-2">
          <TalkingPoint
            title="Walk me through this codebase"
            answer={talkingPoints.walk_me_through_codebase}
            evidenceById={evidenceById}
          />
          <TalkingPoint
            title="What are the riskiest areas?"
            answer={talkingPoints.riskiest_areas}
            evidenceById={evidenceById}
          />
          <TalkingPoint
            title="What would you improve first?"
            answer={talkingPoints.improve_first}
            evidenceById={evidenceById}
          />
          <TalkingPoint
            title="How would you contribute in your first week?"
            answer={talkingPoints.first_week_contribution}
            evidenceById={evidenceById}
          />
        </div>
      </Section>

      <Section title="First PR Plan">
        <div className="grid gap-3 lg:grid-cols-3">
          {candidateBrief.first_pr_plan.map((idea, index) => (
            <article key={`${idea.title}-${index}`} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <div className="flex flex-wrap items-center gap-2">
                <h4 className="text-sm font-semibold text-slate-900">{idea.title}</h4>
                <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-xs text-slate-600">
                  {idea.risk} risk
                </span>
              </div>
              <p className="mt-2 text-sm leading-6 text-slate-700">{idea.rationale}</p>
              {idea.suggested_files.length > 0 && (
                <div className="mt-3 space-y-1">
                  <p className="text-xs font-medium text-slate-500">Suggested files</p>
                  <div className="flex flex-wrap gap-1.5">
                    {idea.suggested_files.map((file) => (
                      <code key={file} className="rounded bg-white px-2 py-1 text-xs text-slate-900">
                        {file}
                      </code>
                    ))}
                  </div>
                </div>
              )}
              <EvidenceList ids={idea.evidence_refs} evidenceById={evidenceById} />
            </article>
          ))}
        </div>
      </Section>

      <Section title="Resume / LinkedIn Bullet">
        <div className="space-y-3">
          {candidateBrief.resume_bullets.map((bullet) => (
            <div key={bullet.audience} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                {bullet.audience}
              </p>
              <p className="mt-1 text-sm leading-6 text-slate-800">{bullet.text}</p>
              <EvidenceList ids={bullet.evidence_refs} evidenceById={evidenceById} />
            </div>
          ))}
        </div>
      </Section>

      {candidateBrief.warnings.length > 0 && (
        <Section title="Confidence Notes">
          <ul className="space-y-2 text-sm text-slate-700">
            {candidateBrief.warnings.map((warning, index) => (
              <li key={index} className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                {warning.message}
                <EvidenceList ids={warning.evidence_refs ?? []} evidenceById={evidenceById} />
              </li>
            ))}
          </ul>
        </Section>
      )}

      <Section title="Evidence">
        <div className="grid gap-2 md:grid-cols-2">
          {candidateBrief.evidence_refs.map((ref) => (
            <div key={ref.id} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <div className="flex flex-wrap items-center gap-2">
                <code className="rounded bg-white px-2 py-1 text-xs text-slate-900">
                  {ref.id}
                </code>
                <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-xs text-slate-600">
                  {ref.kind}
                </span>
              </div>
              <p className="mt-2 text-sm font-medium text-slate-900">{ref.label}</p>
              {ref.path && <p className="mt-1 font-mono text-xs text-slate-600">{ref.path}</p>}
              {ref.command && (
                <p className="mt-1 font-mono text-xs text-slate-600">{ref.command}</p>
              )}
              {ref.detail && <p className="mt-1 text-xs leading-5 text-slate-600">{ref.detail}</p>}
            </div>
          ))}
        </div>
      </Section>
    </div>
  );
}
