"use client";

import { useMemo, useRef } from "react";
import type { BriefAnswer, CandidateBrief, EvidenceRef } from "@/types/report";
import { CopyButton } from "@/components/CopyButton";
import { buildEvidenceUsedByIndex, groupEvidenceByKind } from "@/lib/evidenceIndex";

interface CandidateBriefPanelProps {
  candidateBrief?: CandidateBrief;
  demoMode?: boolean;
}

const SECTION_HELP: Record<string, string> = {
  "Repo Summary": "Use this to open with what the project is and how confident the signals are.",
  "Reading Path": "Use this to decide what to review first before an interview.",
  "Interview Talking Points": "Ready-made answers tied to evidence in this repo.",
  "First PR Plan": "Use this to explain how you would contribute after joining a team.",
  "Walkthrough Script": "Speakable 30s / 2min versions for project interviews.",
  "Behavioral Hooks": "STAR-style prompts grounded in repo evidence only.",
  "Interview Questions": "Practice questions an interviewer might ask from detected signals.",
  "Resume / LinkedIn Bullet": "Copy-ready bullets for applications.",
  Evidence: "Every claim above links back to these detected signals.",
};

const LEGACY_TRADEOFF_FALLBACK: BriefAnswer = {
  answer: "This saved report predates direct tradeoff evidence. Re-run the analysis for a defensible answer.",
  bullets: ["No technical choice is named without a direct manifest or configuration reference."],
  evidence_refs: [],
  confidence: "low",
};

function confidenceClass(confidence: "high" | "medium" | "low") {
  if (confidence === "high") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (confidence === "medium") return "border-amber-200 bg-amber-50 text-amber-700";
  return "border-slate-200 bg-slate-50 text-slate-600";
}

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
  const tooltip = [
    evidence?.label,
    evidence?.path,
    evidence?.detail,
    evidence?.snippet,
  ]
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

function EvidenceList({
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

function Section({
  title,
  children,
  help,
}: {
  title: string;
  children: React.ReactNode;
  help?: string;
}) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4">
      <h3 className="text-base font-semibold text-slate-900">{title}</h3>
      {help && <p className="mt-1 text-xs text-slate-500">{help}</p>}
      <div className="mt-3">{children}</div>
    </section>
  );
}

function TalkingPoint({
  title,
  answer,
  evidenceById,
  onNavigate,
  demoMode,
}: {
  title: string;
  answer: BriefAnswer;
  evidenceById: Map<string, EvidenceRef>;
  onNavigate?: (id: string) => void;
  demoMode?: boolean;
}) {
  const copyText = [answer.answer, ...answer.bullets.map((b) => `• ${b}`)].join("\n");
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <h4 className="text-sm font-semibold text-slate-900">{title}</h4>
          <span
            className={`rounded-full border px-2 py-0.5 text-xs ${confidenceClass(answer.confidence)}`}
          >
            {answer.confidence} confidence
          </span>
        </div>
        <CopyButton text={copyText} label="Copy answer" />
      </div>
      <p className="mt-2 text-sm leading-6 text-slate-700">{answer.answer}</p>
      {answer.bullets.length > 0 && (
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-700">
          {answer.bullets.map((bullet, index) => (
            <li key={index}>{bullet}</li>
          ))}
        </ul>
      )}
      {!demoMode && (
        <EvidenceList ids={answer.evidence_refs} evidenceById={evidenceById} onNavigate={onNavigate} />
      )}
    </div>
  );
}

export function CandidateBriefPanel({ candidateBrief, demoMode }: CandidateBriefPanelProps) {
  const evidenceSectionRef = useRef<HTMLDivElement>(null);
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
    const el = document.getElementById(`evidence-${id}`);
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
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
  const talkingPoints = candidateBrief.interview_talking_points;
  const analysisFocus = candidateBrief.analysis_focus;

  return (
    <div className={`space-y-4 ${demoMode ? "text-[15px]" : ""}`}>
      {analysisFocus && (
        <section className="overflow-hidden rounded-xl border border-emerald-200 bg-emerald-50">
          <div className="border-b border-emerald-200 bg-white/70 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
              Issue-focused Candidate Brief
            </p>
            <h2 className="mt-1 text-lg font-semibold text-slate-900">
              {analysisFocus.label}
            </h2>
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
                            onNavigate={scrollToEvidence}
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

      <Section title="Repo Summary" help={SECTION_HELP["Repo Summary"]}>
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
        {candidateBrief.confidence_assessment && (
          <details className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">
            <summary className="cursor-pointer font-medium text-slate-800">
              Why confidence is {candidateBrief.confidence_assessment.level}
            </summary>
            <ul className="mt-2 list-disc pl-5 text-slate-700">
              {candidateBrief.confidence_assessment.reasons.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
            {candidateBrief.confidence_assessment.gaps.length > 0 && (
              <>
                <p className="mt-2 text-xs font-medium text-slate-500">Gaps</p>
                <ul className="list-disc pl-5 text-slate-600">
                  {candidateBrief.confidence_assessment.gaps.map((g) => (
                    <li key={g}>{g}</li>
                  ))}
                </ul>
              </>
            )}
          </details>
        )}
        {!demoMode && (
          <EvidenceList
            ids={candidateBrief.repo_summary.primary_evidence}
            evidenceById={evidenceById}
            onNavigate={scrollToEvidence}
          />
        )}
      </Section>

      <Section title="Reading Path" help={SECTION_HELP["Reading Path"]}>
        {candidateBrief.reading_path.length === 0 ? (
          <p className="text-sm text-slate-600">No ranked reading path was generated.</p>
        ) : (
          <ol className="space-y-3">
            {candidateBrief.reading_path.map((item) => (
              <li
                key={`${item.order}-${item.path}`}
                className="rounded-lg border border-slate-200 bg-slate-50 p-3"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-emerald-700 text-xs font-semibold text-white">
                    {item.order}
                  </span>
                  <code className="rounded bg-white px-2 py-1 text-xs text-slate-900">
                    {item.path}
                  </code>
                </div>
                <p className="mt-2 text-sm text-slate-700">{item.why}</p>
                {!demoMode && (
                  <EvidenceList
                    ids={item.evidence_refs}
                    evidenceById={evidenceById}
                    onNavigate={scrollToEvidence}
                  />
                )}
              </li>
            ))}
          </ol>
        )}
      </Section>

      <Section title="Interview Talking Points" help={SECTION_HELP["Interview Talking Points"]}>
        <div className="grid gap-3 lg:grid-cols-2">
          <TalkingPoint
            title="Walk me through this codebase"
            answer={talkingPoints.walk_me_through_codebase}
            evidenceById={evidenceById}
            onNavigate={scrollToEvidence}
            demoMode={demoMode}
          />
          <TalkingPoint
            title="What are the riskiest areas?"
            answer={talkingPoints.riskiest_areas}
            evidenceById={evidenceById}
            onNavigate={scrollToEvidence}
            demoMode={demoMode}
          />
          <TalkingPoint
            title="What tradeoffs does this repository contain?"
            answer={talkingPoints.tradeoffs ?? LEGACY_TRADEOFF_FALLBACK}
            evidenceById={evidenceById}
            onNavigate={scrollToEvidence}
            demoMode={demoMode}
          />
          <TalkingPoint
            title="What would you improve first?"
            answer={talkingPoints.improve_first}
            evidenceById={evidenceById}
            onNavigate={scrollToEvidence}
            demoMode={demoMode}
          />
        </div>
        <div className="mt-4 border-t border-slate-200 pt-4">
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">
            Extra preparation
          </p>
          <TalkingPoint
            title="How would you contribute in your first week?"
            answer={talkingPoints.first_week_contribution}
            evidenceById={evidenceById}
            onNavigate={scrollToEvidence}
            demoMode={demoMode}
          />
        </div>
      </Section>

      {candidateBrief.walkthrough_script && (
        <Section title="Walkthrough Script" help={SECTION_HELP["Walkthrough Script"]}>
          <div className="space-y-3 text-sm text-slate-700">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-medium text-slate-900">30-second</p>
                <p className="mt-1">{candidateBrief.walkthrough_script.thirty_second}</p>
              </div>
              <CopyButton text={candidateBrief.walkthrough_script.thirty_second} label="Copy 30s" />
            </div>
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-medium text-slate-900">2-minute</p>
                <p className="mt-1">{candidateBrief.walkthrough_script.two_minute}</p>
              </div>
              <CopyButton text={candidateBrief.walkthrough_script.two_minute} label="Copy 2min" />
            </div>
            <p className="font-medium text-slate-900">Deep technical</p>
            <p>{candidateBrief.walkthrough_script.deep_technical}</p>
          </div>
        </Section>
      )}

      {candidateBrief.behavioral_hooks && candidateBrief.behavioral_hooks.length > 0 && (
        <Section title="Behavioral Hooks" help={SECTION_HELP["Behavioral Hooks"]}>
          <ul className="space-y-2 text-sm">
            {candidateBrief.behavioral_hooks.map((hook) => (
              <li key={hook.prompt} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <p className="font-medium text-slate-900">{hook.prompt}</p>
                <p className="mt-1 text-slate-700">{hook.answer_starter}</p>
                {!demoMode && (
                  <EvidenceList
                    ids={hook.evidence_refs}
                    evidenceById={evidenceById}
                    onNavigate={scrollToEvidence}
                  />
                )}
              </li>
            ))}
          </ul>
        </Section>
      )}

      {candidateBrief.interview_questions && candidateBrief.interview_questions.length > 0 && (
        <Section title="Interview Questions" help={SECTION_HELP["Interview Questions"]}>
          <ul className="space-y-2 text-sm text-slate-700">
            {candidateBrief.interview_questions.map((q) => (
              <li key={q.question} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <p className="font-medium text-slate-900">{q.question}</p>
                <p className="mt-1 text-xs text-slate-500">{q.rationale}</p>
              </li>
            ))}
          </ul>
        </Section>
      )}

      <Section title="First PR Plan" help={SECTION_HELP["First PR Plan"]}>
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
                  onNavigate={scrollToEvidence}
                />
              )}
            </article>
          ))}
        </div>
      </Section>

      <Section title="Resume / LinkedIn Bullet" help={SECTION_HELP["Resume / LinkedIn Bullet"]}>
        <div className="space-y-3">
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
                  onNavigate={scrollToEvidence}
                />
              )}
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
                {!demoMode && (
                  <EvidenceList
                    ids={warning.evidence_refs ?? []}
                    evidenceById={evidenceById}
                    onNavigate={scrollToEvidence}
                  />
                )}
              </li>
            ))}
          </ul>
        </Section>
      )}

      {!demoMode && (
        <Section title="Evidence" help={SECTION_HELP.Evidence}>
          <div ref={evidenceSectionRef} className="space-y-4">
            {Object.entries(grouped).map(([kind, refs]) => (
              <div key={kind}>
                <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  {kind}
                </h4>
                <div className="mt-2 grid gap-2 md:grid-cols-2">
                  {refs.map((ref) => (
                    <div
                      key={ref.id}
                      id={`evidence-${ref.id}`}
                      className="rounded-lg border border-slate-200 bg-slate-50 p-3 scroll-mt-24"
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
                      {ref.snippet && (
                        <pre className="mt-2 overflow-x-auto rounded bg-white p-2 text-xs text-slate-700">
                          {ref.snippet}
                        </pre>
                      )}
                      {usedBy.get(ref.id) && (
                        <p className="mt-2 text-xs text-slate-500">
                          Used by: {usedBy.get(ref.id)!.join(", ")}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Section>
      )}

      <p className="text-xs text-slate-500">
        RepoAtlas does not execute uploaded code. Claims are limited to detected static signals.
      </p>
    </div>
  );
}
