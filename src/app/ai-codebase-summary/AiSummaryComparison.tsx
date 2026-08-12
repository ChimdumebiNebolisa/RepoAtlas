import { ComparisonEntrance } from "@/components/ComparisonEntrance";
import type { HomepageSamplePreview } from "@/lib/homepageSamplePreview";

const comparisonRows = [
  {
    criterion: "Primary job",
    summary: "Give you a fast orientation to the repository.",
    brief: "Build a reading route and interview answers you can verify.",
  },
  {
    criterion: "How it is produced",
    summary: "Uses an AI model. Context selection and retrieval vary by product.",
    brief: "Uses deterministic static analysis without calling AI or executing repository code.",
  },
  {
    criterion: "Source traceability",
    summary: "Check whether the product links each repository-specific statement to its source.",
    brief: "Links supported repository claims to inspectable files, relationships, and configuration.",
  },
  {
    criterion: "Interview format",
    summary: "Often starts as an overview. Templates and follow-up tools vary.",
    brief: "Includes a reading order, 30-second and 2-minute walkthroughs, questions, and evidence.",
  },
  {
    criterion: "Limits",
    summary: "Check how the product reports missing context, uncertainty, and unsupported languages.",
    brief: "Shows confidence notes and analyzer warnings, and keeps runtime behavior and intent unknown.",
  },
] as const;

export function AiSummaryComparison({
  sample,
}: {
  sample: HomepageSamplePreview | null;
}) {
  return (
    <>
      <header className="guide-hero comparison-hero page-container">
        <div className="guide-hero-copy comparison-hero-copy">
          <p className="eyebrow">AI codebase summary comparison</p>
          <h1>AI summary or evidence-linked interview brief?</h1>
          <p>
            Both can help you orient to a repository. The useful difference is the output:
            a quick overview, or a repeatable walkthrough whose repository claims lead back to
            files you can inspect.
          </p>
        </div>

        <ComparisonEntrance sample={sample} variant="ai-summary" />
      </header>

      <div className="comparison-route-section page-container">
        <div className="comparison-route-map ai-summary-route-map" aria-label="Two repository summary outputs">
          <p>Choose the output you need</p>
          <div className="comparison-route">
            <span>AI codebase summary</span>
            <strong>Orient quickly</strong>
            <small>Useful when you need a broad starting model or a focused explanation.</small>
          </div>
          <div className="ai-summary-route-divider" aria-hidden="true">
            <span>or</span>
          </div>
          <div className="comparison-route comparison-route-structured">
            <span>Evidence-linked brief</span>
            <strong>Prepare to explain</strong>
            <small>Useful when each talking point must resolve to repository evidence.</small>
          </div>
          <div className="comparison-route-join">
            <span>Either way</span>
            <p>Check what the tool proves, what it infers, and what only you can supply.</p>
          </div>
        </div>
      </div>

      <section className="guide-intro page-container" aria-labelledby="definition-heading">
        <p className="guide-margin-note">Start with the job</p>
        <div>
          <h2 id="definition-heading">A repository overview is not the same as interview preparation.</h2>
          <p>
            An AI codebase summary uses a model to explain repository content. The files it reads,
            the context it keeps, the citations it provides, and the privacy boundary depend on
            the product you choose.
          </p>
          <p>
            An interview-ready brief has a narrower job. It should give you a reading order,
            speakable answers, and a way to check every repository-specific statement before you
            repeat it.
          </p>
        </div>
      </section>

      <section className="ai-summary-matrix-section page-container" aria-labelledby="matrix-heading">
        <header className="guide-section-heading">
          <p className="section-kicker">Compare the mechanisms</p>
          <h2 id="matrix-heading">Ask what you receive and how you can check it.</h2>
          <p>
            AI summary products do not share one feature set or privacy model. Use the left
            column as questions for the specific product you are considering.
          </p>
        </header>

        <div
          className="ai-summary-matrix"
          role="table"
          aria-label="AI summary and Candidate Brief comparison"
          tabIndex={0}
        >
          <div className="ai-summary-matrix-header" role="row">
            <span role="columnheader">Criterion</span>
            <span role="columnheader">AI codebase summary</span>
            <span role="columnheader">RepoAtlas Candidate Brief</span>
          </div>
          {comparisonRows.map((row) => (
            <div className="ai-summary-matrix-row" role="row" key={row.criterion}>
              <strong role="rowheader">{row.criterion}</strong>
              <p role="cell">{row.summary}</p>
              <p role="cell">{row.brief}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="comparison-choice-section page-container" aria-labelledby="enough-heading">
        <header className="guide-section-heading">
          <p className="section-kicker">Use the lighter output when it works</p>
          <h2 id="enough-heading">A quick summary can be enough.</h2>
          <p>
            Match the preparation depth to the conversation. More output is not automatically
            more useful.
          </p>
        </header>

        <div className="comparison-choice-grid">
          <article>
            <span>A summary can work when</span>
            <h3>You need orientation, not a rehearsed walkthrough.</h3>
            <ul>
              <li>You are deciding whether the repository is relevant.</li>
              <li>You need definitions for unfamiliar folders or concepts.</li>
              <li>You already know which files you will verify yourself.</li>
            </ul>
            <p>Check citations, repository coverage, and product limits before trusting a specific claim.</p>
          </article>

          <article className="comparison-choice-structured">
            <span>A Candidate Brief helps when</span>
            <h3>You need a route you can explain under questioning.</h3>
            <ul>
              <li>The repository is unfamiliar and the interview can widen.</li>
              <li>You need both a short answer and a deeper system path.</li>
              <li>You want repository claims to resolve to inspectable evidence.</li>
            </ul>
            <p>The brief organizes evidence. It does not replace your judgment or personal context.</p>
          </article>
        </div>
      </section>
    </>
  );
}
