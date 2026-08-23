import type { BriefAnswer, CandidateBrief, EvidenceRef } from "@/types/report";
import { CopyButton } from "@/components/CopyButton";
import { CandidateBriefWalkthrough } from "@/components/CandidateBriefWalkthrough";
import { EvidenceList } from "@/components/EvidenceLinks";
import type { ReportVariant } from "@/lib/productAnalytics";

const SECTION_HELP: Record<string, string> = {
  "Repo Summary": "Use this to open with what the project is and how confident the signals are.",
  "Reading Path": "Use this to decide what to review first before an interview.",
  "System Flow": "Connect the likely entry point, boundaries, and result without adding runtime claims.",
  "Interview Talking Points": "Ready-made answers tied to evidence in this repo.",
  "First PR Plan": "Use this to explain how you would contribute after joining a team.",
  "Walkthrough Script": "Speakable 30s / 2min versions for project interviews.",
  "Behavioral Hooks": "STAR-style prompts grounded in repo evidence only.",
  "Interview Questions": "Practice questions an interviewer might ask from detected signals.",
  Evidence: "Every claim above links back to these detected signals.",
};

function confidenceClass(confidence: "high" | "medium" | "low") {
  if (confidence === "high") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (confidence === "medium") return "border-amber-200 bg-amber-50 text-amber-700";
  return "border-slate-200 bg-slate-50 text-slate-600";
}

export function CandidateBriefSection({
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
  const copyText = [answer.answer, ...answer.bullets.map((bullet) => `• ${bullet}`)].join("\n");
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

function SystemFlowSection({
  walkthrough,
  evidenceById,
  onNavigate,
  demoMode,
}: {
  walkthrough?: CandidateBrief["walkthrough_script"];
  evidenceById: Map<string, EvidenceRef>;
  onNavigate?: (id: string) => void;
  demoMode?: boolean;
}) {
  const hasFlowEvidence = Boolean(
    walkthrough &&
      walkthrough.evidence_refs.some((id) => evidenceById.has(id)) &&
      !walkthrough.deep_technical.startsWith("Not enough evidence")
  );

  return (
    <CandidateBriefSection title="System Flow" help={SECTION_HELP["System Flow"]}>
      {hasFlowEvidence && walkthrough ? (
        <>
          <p className="text-sm leading-6 text-slate-700">{walkthrough.deep_technical}</p>
          {!demoMode && (
            <EvidenceList
              ids={walkthrough.evidence_refs}
              evidenceById={evidenceById}
              onNavigate={onNavigate}
            />
          )}
        </>
      ) : (
        <p className="text-sm leading-6 text-slate-700">
          The repository does not provide enough evidence for a system flow. Use the reading path
          and evidence index, and confirm runtime behavior before describing it.
        </p>
      )}
    </CandidateBriefSection>
  );
}

interface CandidateBriefCoreSectionsProps {
  candidateBrief: CandidateBrief;
  evidenceById: Map<string, EvidenceRef>;
  onNavigate: (id: string) => void;
  demoMode?: boolean;
  reportVariant: ReportVariant;
}

export function CandidateBriefCoreSections({
  candidateBrief,
  evidenceById,
  onNavigate,
  demoMode,
  reportVariant,
}: CandidateBriefCoreSectionsProps) {
  const talkingPoints = candidateBrief.interview_talking_points;

  return (
    <>
      <CandidateBriefSection title="Repo Summary" help={SECTION_HELP["Repo Summary"]}>
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
              {candidateBrief.confidence_assessment.reasons.map((reason) => (
                <li key={reason}>{reason}</li>
              ))}
            </ul>
            {candidateBrief.confidence_assessment.gaps.length > 0 && (
              <>
                <p className="mt-2 text-xs font-medium text-slate-500">Gaps</p>
                <ul className="list-disc pl-5 text-slate-600">
                  {candidateBrief.confidence_assessment.gaps.map((gap) => (
                    <li key={gap}>{gap}</li>
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
            onNavigate={onNavigate}
          />
        )}
      </CandidateBriefSection>

      {candidateBrief.walkthrough_script && (
        <CandidateBriefWalkthrough
          walkthrough={candidateBrief.walkthrough_script}
          reportVariant={reportVariant}
        />
      )}

      <CandidateBriefSection title="Reading Path" help={SECTION_HELP["Reading Path"]}>
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
                    onNavigate={onNavigate}
                  />
                )}
              </li>
            ))}
          </ol>
        )}
      </CandidateBriefSection>

      <SystemFlowSection
        walkthrough={candidateBrief.walkthrough_script}
        evidenceById={evidenceById}
        onNavigate={onNavigate}
        demoMode={demoMode}
      />

      <CandidateBriefSection
        title="Interview Talking Points"
        help={SECTION_HELP["Interview Talking Points"]}
      >
        <div className="grid gap-3 lg:grid-cols-2">
          <TalkingPoint
            title="Walk me through this codebase"
            answer={talkingPoints.walk_me_through_codebase}
            evidenceById={evidenceById}
            onNavigate={onNavigate}
            demoMode={demoMode}
          />
          <TalkingPoint
            title="What are the riskiest areas?"
            answer={talkingPoints.riskiest_areas}
            evidenceById={evidenceById}
            onNavigate={onNavigate}
            demoMode={demoMode}
          />
          <TalkingPoint
            title="What tradeoffs does this repository contain?"
            answer={talkingPoints.tradeoffs}
            evidenceById={evidenceById}
            onNavigate={onNavigate}
            demoMode={demoMode}
          />
          <TalkingPoint
            title="What would you improve first?"
            answer={talkingPoints.improve_first}
            evidenceById={evidenceById}
            onNavigate={onNavigate}
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
            onNavigate={onNavigate}
            demoMode={demoMode}
          />
        </div>
      </CandidateBriefSection>
    </>
  );
}
