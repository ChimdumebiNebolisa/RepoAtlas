import Link from "next/link";
import { TrackedAnalysisLink } from "@/components/TrackedAnalysisLink";
import { candidateBriefSampleAction } from "@/lib/candidateBriefContent";
import type { HomepageSamplePreview } from "@/lib/homepageSamplePreview";
import type { ComparisonSourceToken } from "@/lib/analysisAttribution";

type ComparisonEntranceVariant = "structured-preparation" | "ai-summary";

const evidenceBackedBriefPromise =
  "Prepare to explain a repository with the ranked reading path, architecture context, source-backed commands, test inventory, and structural risk signals shown in the public FastAPI example. The example contains 12 starting files, 35 architecture nodes, 8 commands, 23 test files, and 127 risk signals. Its risk signals guide inspection; they do not prove runtime behavior, bugs, or vulnerabilities.";

const entranceCopy: Record<
  ComparisonEntranceVariant,
  {
    entrySource: ComparisonSourceToken;
  }
> = {
  "structured-preparation": {
    entrySource: "comparison_structured_preparation",
  },
  "ai-summary": {
    entrySource: "comparison_ai_summary",
  },
};

export function ComparisonEntrance({
  sample,
  variant,
}: {
  sample: HomepageSamplePreview | null;
  variant: ComparisonEntranceVariant;
}) {
  const copy = entranceCopy[variant];
  const analysisHref = `/?source=${copy.entrySource}#analyze`;

  return (
    <aside
      className="comparison-entrance"
      aria-label="Start an evidence-linked Candidate Brief"
    >
      <div className="comparison-entrance-heading">
        <span>Bundled Candidate Brief</span>
        <strong>See what you will receive.</strong>
        <p>{evidenceBackedBriefPromise}</p>
      </div>

      {sample ? (
        <div className="comparison-entrance-proof" data-testid="comparison-sample-proof">
          <span>Real file-backed sample</span>
          {sample.comparisonProof ? (
            <>
              <div className="comparison-proof-reading">
                <small>Reading sequence</small>
                <ol>
                  {sample.comparisonProof.readingSequence.map((path) => (
                    <li key={path}>
                      <code>{path}</code>
                    </li>
                  ))}
                </ol>
              </div>
              <div className="comparison-proof-risk">
                <small>Danger Zone</small>
                <div>
                  <code>{sample.comparisonProof.dangerZone.path}</code>
                  <p>
                    Risk {sample.comparisonProof.dangerZone.score} out of 100, with
                    complexity {sample.comparisonProof.dangerZone.complexity} and{" "}
                    {sample.comparisonProof.dangerZone.fanOut} outgoing file links.
                  </p>
                </div>
              </div>
            </>
          ) : (
            <div>
              <small>Read first</small>
              <code>{sample.readingStep.path}</code>
            </div>
          )}
        </div>
      ) : (
        <p className="comparison-entrance-unavailable">
          Open the bundled brief to inspect its available repository evidence.
        </p>
      )}

      <div className="comparison-entrance-actions">
        <TrackedAnalysisLink
          className="comparison-primary-action"
          entrySource={copy.entrySource}
          startSample
        >
          {candidateBriefSampleAction}
        </TrackedAnalysisLink>
        <Link className="comparison-github-action" href={analysisHref}>
          Use a public GitHub repository <span aria-hidden="true">→</span>
        </Link>
      </div>
      <p className="comparison-action-note">
        No upload is needed for the sample. RepoAtlas reads files without executing code.
      </p>
      <Link
        className="comparison-example-link"
        href="/examples/fastapi-candidate-brief"
      >
        Inspect the public FastAPI repository example <span aria-hidden="true">→</span>
      </Link>
    </aside>
  );
}
