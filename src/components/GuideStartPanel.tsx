import Link from "next/link";
import { TrackedAnalysisLink } from "@/components/TrackedAnalysisLink";
import {
  candidateBriefProofPromise,
  candidateBriefSampleAction,
} from "@/lib/candidateBriefContent";

const analysisHref = "/?source=interview_preparation#analyze";

type GuideStartPanelProps = {
  ariaLabel?: string;
  description?: string;
  heading?: string;
  startSample?: boolean;
};

export function GuideStartPanel({
  ariaLabel = "Start a repository walkthrough",
  description = candidateBriefProofPromise,
  heading = "Start with a repository.",
  startSample = true,
}: GuideStartPanelProps = {}) {
  return (
    <aside className="guide-start-panel" aria-label={ariaLabel}>
      <div className="guide-start-heading">
        <strong>{heading}</strong>
        <span>{description}</span>
      </div>
      <div className="guide-start-actions">
        <TrackedAnalysisLink
          className="guide-start-primary"
          entrySource="interview_preparation"
          startSample={startSample}
        >
          {candidateBriefSampleAction}
        </TrackedAnalysisLink>
        <Link className="guide-start-github" href={analysisHref}>
          Use a public GitHub repository <span aria-hidden="true">→</span>
        </Link>
      </div>
    </aside>
  );
}
