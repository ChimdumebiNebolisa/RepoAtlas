"use client";

import { useId } from "react";

export function CandidateBriefSampleNextStep({
  onAnalyzeRepository,
}: {
  onAnalyzeRepository: () => void;
}) {
  const headingId = useId();

  return (
    <aside className="report-sample-next-step" aria-labelledby={headingId}>
      <div>
        <p className="report-sample-next-step-eyebrow">Try your repository</p>
        <h2 id={headingId}>Now map a repository you need to explain.</h2>
        <p>
          Paste a public GitHub URL to build the same evidence-linked interview brief for your code.
        </p>
      </div>
      <button
        type="button"
        className="report-action report-action-primary report-sample-next-step-action"
        onClick={onAnalyzeRepository}
      >
        Analyze my public GitHub repository
      </button>
    </aside>
  );
}
