import type { CandidateBrief, EvidenceRef } from "@/types/report";
import { CopyButton } from "@/components/CopyButton";
import { CandidateBriefSection } from "@/components/CandidateBriefCoreSections";
import { EvidenceList } from "@/components/EvidenceLinks";

interface CandidateBriefPreparationSectionsProps {
  candidateBrief: CandidateBrief;
  evidenceById: Map<string, EvidenceRef>;
  onNavigate: (id: string) => void;
  demoMode?: boolean;
}

export function CandidateBriefPreparationSections({
  candidateBrief,
  evidenceById,
  onNavigate,
  demoMode,
}: CandidateBriefPreparationSectionsProps) {
  const analysisFocus = candidateBrief.analysis_focus;

  return (
    <>
      {analysisFocus && (
        <section className="overflow-hidden rounded-xl border border-emerald-200 bg-emerald-50">
          <div className="border-b border-emerald-200 bg-white/70 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
              Issue-focused Candidate Brief
            </p>
            <h2 className="mt-1 text-lg font-semibold text-slate-900">{analysisFocus.label}</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-700">
              {analysisFocus.summary}
            </p>
          </div>
          <div className="grid gap-4 p-4 lg:grid-cols-[1.35fr_0.65fr]">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">Evidence-backed review path</h3>
              <ol className="mt-3 space-y-2">
                {analysisFocus.review_steps.map((step, index) => (
                  <li key={step.title} className="rounded-lg border border-emerald-100 bg-white p-3">
                    <div className="flex items-start gap-3">
                      <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-700 text-xs font-semibold text-white">
                        {index + 1}
                      </span>
                      <div>
                        <h4 className="text-sm font-semibold text-slate-900">{step.title}</h4>
                        <p className="mt-1 text-sm leading-6 text-slate-700">{step.detail}</p>
                        {!demoMode && (
                          <EvidenceList
                            ids={step.evidence_refs}
                            evidenceById={evidenceById}
                            onNavigate={onNavigate}
                          />
                        )}
                      </div>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
            <div className="rounded-lg border border-emerald-100 bg-white p-3">
              <h3 className="text-sm font-semibold text-slate-900">Questions to bring</h3>
              <ul className="mt-3 space-y-3 text-sm leading-6 text-slate-700">
                {analysisFocus.discussion_questions.map((question) => (
                  <li key={question} className="flex gap-2">
                    <span aria-hidden="true" className="text-emerald-700">→</span>
                    <span>{question}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>
      )}

      {candidateBrief.behavioral_hooks && candidateBrief.behavioral_hooks.length > 0 && (
        <CandidateBriefSection
          title="Behavioral Hooks"
          help="STAR-style prompts grounded in repo evidence only."
        >
          <ul className="space-y-2 text-sm">
            {candidateBrief.behavioral_hooks.map((hook) => (
              <li key={hook.prompt} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <p className="font-medium text-slate-900">{hook.prompt}</p>
                <p className="mt-1 text-slate-700">{hook.answer_starter}</p>
                {!demoMode && (
                  <EvidenceList
                    ids={hook.evidence_refs}
                    evidenceById={evidenceById}
                    onNavigate={onNavigate}
                  />
                )}
              </li>
            ))}
          </ul>
        </CandidateBriefSection>
      )}

      {candidateBrief.interview_questions && candidateBrief.interview_questions.length > 0 && (
        <CandidateBriefSection
          title="Interview Questions"
          help="Practice questions an interviewer might ask from detected signals."
        >
          <ul className="space-y-2 text-sm text-slate-700">
            {candidateBrief.interview_questions.map((question) => (
              <li
                key={question.question}
                className="rounded-lg border border-slate-200 bg-slate-50 p-3"
              >
                <p className="font-medium text-slate-900">{question.question}</p>
                <p className="mt-1 text-xs text-slate-500">{question.rationale}</p>
              </li>
            ))}
          </ul>
        </CandidateBriefSection>
      )}

      <CandidateBriefSection
        title="First PR Plan"
        help="Use this to explain how you would contribute after joining a team."
      >
        <div className="grid gap-3 lg:grid-cols-3">
          {candidateBrief.first_pr_plan.map((idea, index) => (
            <article
              key={`${idea.title}-${index}`}
              className="rounded-lg border border-slate-200 bg-slate-50 p-3"
            >
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
              {!demoMode && (
                <EvidenceList
                  ids={idea.evidence_refs}
                  evidenceById={evidenceById}
                  onNavigate={onNavigate}
                />
              )}
            </article>
          ))}
        </div>
      </CandidateBriefSection>

      <details className="rounded-xl border border-slate-200 bg-white p-4">
        <summary className="cursor-pointer list-none">
          <span className="block text-xs font-medium uppercase tracking-wide text-slate-500">
            Extra preparation
          </span>
          <span className="mt-1 block text-sm font-semibold text-slate-900">
            Resume and profile bullets
          </span>
        </summary>
        <div className="mt-4 space-y-3">
          {candidateBrief.resume_bullets.map((bullet) => (
            <div key={bullet.audience} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                  {bullet.audience}
                </p>
                <CopyButton text={bullet.text} label={`Copy ${bullet.audience}`} />
              </div>
              <p className="mt-1 text-sm leading-6 text-slate-800">{bullet.text}</p>
              {!demoMode && (
                <EvidenceList
                  ids={bullet.evidence_refs}
                  evidenceById={evidenceById}
                  onNavigate={onNavigate}
                />
              )}
            </div>
          ))}
        </div>
      </details>
    </>
  );
}
