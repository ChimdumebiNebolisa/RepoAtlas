import Link from "next/link";
import { TrackedAnalysisLink } from "@/components/TrackedAnalysisLink";

const analysisHref = "/?source=interview_preparation#analyze";

export function GuideStartPanel() {
  return (
    <aside className="guide-start-panel" aria-label="Start a repository walkthrough">
      <div className="guide-start-heading">
        <strong>Start with a repository.</strong>
        <span>Open a Candidate Brief now, then use the method below to explain it.</span>
      </div>
      <div className="guide-start-actions">
        <TrackedAnalysisLink
          className="guide-start-primary"
          entrySource="interview_preparation"
        >
          Run the bundled sample
        </TrackedAnalysisLink>
        <Link className="guide-start-github" href={analysisHref}>
          Use a public GitHub repository <span aria-hidden="true">→</span>
        </Link>
      </div>
    </aside>
  );
}
