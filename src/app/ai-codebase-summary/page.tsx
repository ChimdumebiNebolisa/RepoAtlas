import type { Metadata } from "next";
import Link from "next/link";
import { ComparisonEntrance } from "@/components/ComparisonEntrance";
import { SiteHeader } from "@/components/SiteHeader";
import { analyzeBundledSample } from "@/lib/bundledSample";
import { buildHomepageSamplePreview } from "@/lib/homepageSamplePreview";

const canonicalUrl = "https://repo-atlas-phi.vercel.app/ai-codebase-summary";

const title = "AI Codebase Summary vs. Evidence-Linked Brief | RepoAtlas";
const description =
  "Compare an AI codebase summary with a deterministic, evidence-linked Candidate Brief for repository interview preparation.";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: canonicalUrl },
  openGraph: {
    title,
    description,
    type: "article",
    url: canonicalUrl,
  },
};

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
    brief: "Links repository claims to inspectable files and configuration.",
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

const claimChecks = [
  {
    claim: "Entry point",
    evidence: "Look for a manifest script, framework convention, route, or executable main function.",
  },
  {
    claim: "Architecture",
    evidence: "Resolve both ends of an import or dependency path to files in the repository.",
  },
  {
    claim: "Risk signal",
    evidence: "Treat size, churn, coupling, or sparse tests as inspection priorities, not confirmed defects.",
  },
  {
    claim: "Testing",
    evidence: "Check test files, framework configuration, and continuous-integration commands together.",
  },
  {
    claim: "Technical choice",
    evidence: "Use manifests and configuration to show what was selected, without inventing why.",
  },
] as const;

export default async function AiCodebaseSummaryPage() {
  const { report } = await analyzeBundledSample();
  const sample = buildHomepageSamplePreview(report);

  return (
    <main className="site-shell guide-page comparison-page ai-summary-page">
      <div className="site-grid" aria-hidden="true" />
      <SiteHeader />

      <article>
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

          <div className="ai-summary-matrix" role="table" aria-label="AI summary and Candidate Brief comparison">
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

        <section className="guide-reading-section page-container" aria-labelledby="claims-heading">
          <header className="guide-section-heading">
            <p className="section-kicker">Verify the claims that shape your answer</p>
            <h2 id="claims-heading">Follow important statements back to files.</h2>
            <p>
              A claim becomes useful in an interview when you can show the evidence and state its
              limit. For the complete reading method, use the{" "}
              <Link href="/repository-walkthrough-interview">repository walkthrough interview guide</Link>.
            </p>
          </header>

          <ol className="comparison-workflow ai-summary-claim-checks">
            {claimChecks.map((item, index) => (
              <li key={item.claim}>
                <span className="guide-step-index">{String(index + 1).padStart(2, "0")}</span>
                <div>
                  <p>Check</p>
                  <h3>{item.claim}</h3>
                </div>
                <p>{item.evidence}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="guide-architecture-section" aria-labelledby="unknown-heading">
          <div className="page-container comparison-answer-layout">
            <header>
              <p className="section-kicker">Keep the unknowns visible</p>
              <h2 id="unknown-heading">Repository evidence cannot tell your story.</h2>
              <p>
                Files can support technical facts. They cannot establish a person&apos;s authorship,
                the reason behind a decision, or the result in production.
              </p>
            </header>

            <div className="comparison-answer-depths">
              <article>
                <span>You supply</span>
                <h3>Contribution and constraints</h3>
                <p>Name what you owned, what the task required, and which limits shaped your work.</p>
              </article>
              <article>
                <span>You explain</span>
                <h3>Rationale and rejected alternatives</h3>
                <p>Describe why you chose an approach. Do not ask the repository to prove intent.</p>
              </article>
              <article>
                <span>You verify</span>
                <h3>Runtime behavior and outcomes</h3>
                <p>Use measurements, logs, or your direct experience instead of inferring results from structure.</p>
              </article>
            </div>
          </div>
        </section>

        <section className="ai-summary-checklist-section page-container" aria-labelledby="checklist-heading">
          <header className="guide-section-heading">
            <p className="section-kicker">Before you choose a tool</p>
            <h2 id="checklist-heading">Verify the product&apos;s actual boundary.</h2>
            <p>
              Do not assume that every AI repository tool handles code, citations, or storage the
              same way. Read the product&apos;s current documentation and terms.
            </p>
          </header>

          <ul className="ai-summary-tool-checklist">
            <li>
              <span>01</span>
              <div>
                <h3>Repository access</h3>
                <p>Which public and private repository sources can the product read?</p>
              </div>
            </li>
            <li>
              <span>02</span>
              <div>
                <h3>Code execution</h3>
                <p>Does it read files only, or can it install dependencies and execute repository code?</p>
              </div>
            </li>
            <li>
              <span>03</span>
              <div>
                <h3>Data handling</h3>
                <p>Where is repository content sent, how long is it retained, and who can access it?</p>
              </div>
            </li>
            <li>
              <span>04</span>
              <div>
                <h3>Claim traceability</h3>
                <p>Can you open the exact file or configuration behind each important statement?</p>
              </div>
            </li>
          </ul>
        </section>

        <section className="comparison-proof-section page-container" aria-labelledby="repoatlas-heading">
          <header className="guide-section-heading">
            <p className="section-kicker">RepoAtlas&apos;s published boundary</p>
            <h2 id="repoatlas-heading">Deterministic, file-backed, and explicit about limits.</h2>
            <p>
              RepoAtlas reads repository files as text. It does not call AI or execute uploaded
              code. The Candidate Brief connects its repository-specific claims to evidence,
              confidence notes, and analyzer warnings.
            </p>
          </header>

          <div className="comparison-proof-grid">
            <article>
              <span>Included</span>
              <h3>Interview-ready structure</h3>
              <p>Entry points, reading order, architecture, risk signals, timed scripts, questions, and evidence.</p>
            </article>
            <article>
              <span>Bounded</span>
              <h3>Static repository evidence</h3>
              <p>Risk scores direct inspection. They are not bug, vulnerability, or runtime findings.</p>
            </article>
            <article>
              <span>Portable</span>
              <h3>Dependable exports</h3>
              <p>PDF and PNG are available. Markdown and saved server links depend on storage.</p>
            </article>
          </div>
        </section>

        <section className="comparison-next-section page-container" aria-labelledby="next-heading">
          <header>
            <p className="section-kicker">Continue with the right guide</p>
            <h2 id="next-heading">Prepare the repository facts and your own context.</h2>
          </header>
          <div className="comparison-guide-links">
            <Link href="/repository-walkthrough-interview">
              <span>Unfamiliar repository</span>
              <strong>Learn the complete evidence-first walkthrough</strong>
              <small>Build a reading order, trace architecture, and prepare follow-up questions.</small>
            </Link>
            <Link href="/how-to-walk-through-a-project-in-an-interview">
              <span>Your project or take-home</span>
              <strong>Add contribution, rationale, and outcomes</strong>
              <small>Separate what you know from what the repository can support.</small>
            </Link>
          </div>
        </section>
      </article>
    </main>
  );
}
