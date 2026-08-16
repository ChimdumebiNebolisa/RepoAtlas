import type { Metadata } from "next";
import Link from "next/link";
import { GuideStartPanel } from "@/components/GuideStartPanel";
import { SiteHeader } from "@/components/SiteHeader";
import { candidateBriefProofPromise } from "@/lib/candidateBriefContent";
import {
  takeHomeAnswerFrames,
  takeHomeEvidenceLayers,
  takeHomeInterviewMetadata,
  takeHomeReviewPasses,
} from "@/lib/takeHomeInterviewContent";

const canonicalUrl = "https://repo-atlas-phi.vercel.app/take-home-coding-interview";

export const metadata: Metadata = {
  title: takeHomeInterviewMetadata.title,
  description: takeHomeInterviewMetadata.description,
  alternates: { canonical: canonicalUrl },
  openGraph: {
    title: takeHomeInterviewMetadata.title,
    description: takeHomeInterviewMetadata.openGraphDescription,
    type: "article",
    url: canonicalUrl,
  },
};

export default function TakeHomeCodingInterviewPage() {
  return (
    <main className="site-shell guide-page take-home-guide-page">
      <div className="site-grid" aria-hidden="true" />
      <SiteHeader />

      <article>
        <header className="guide-hero take-home-guide-hero page-container">
          <div className="guide-hero-copy take-home-guide-copy">
            <p className="eyebrow">Take-home coding interview review</p>
            <h1>Review your take-home before you explain it.</h1>
            <p className="guide-hero-intro">
              Rehearse the repository as a technical decision, not a feature tour. Show the core
              path, why you made one choice, which test protects it, and what you would change.
            </p>
            <GuideStartPanel
              ariaLabel="Start a take-home coding interview review"
              heading="Add the file-backed structure."
              description={`${candidateBriefProofPromise} You add the brief, constraints, rationale, and outcome.`}
            />
          </div>

          <div className="take-home-review-board" aria-label="Take-home interview review docket">
            <div className="take-home-board-heading">
              <span>Review docket</span>
              <strong>Submitted repository</strong>
              <code>interview-ready / 05 passes</code>
            </div>
            <ol>
              <li><span>01</span><strong>Brief</strong><small>state the constraint</small></li>
              <li><span>02</span><strong>Core path</strong><small>trace the result</small></li>
              <li><span>03</span><strong>Decision</strong><small>defend the tradeoff</small></li>
              <li><span>04</span><strong>Proof</strong><small>show the test</small></li>
              <li><span>05</span><strong>Limit</strong><small>name what comes next</small></li>
            </ol>
            <blockquote>
              &quot;Here is what I prioritized, where it lives, and what I would verify next.&quot;
            </blockquote>
          </div>
        </header>

        <section className="guide-intro page-container" aria-labelledby="take-home-evaluation-heading">
          <p className="guide-margin-note">What the review is testing</p>
          <div>
            <h2 id="take-home-evaluation-heading">Explain the decisions behind a bounded solution.</h2>
            <p>
              A take-home review is not a request to tour every file. The interviewer wants to see
              how you reduced the brief, chose a path, checked it, and handled the time limit.
            </p>
            <p>
              Keep the repository evidence and your reasoning separate. The files can support the
              structure. Only you can explain the constraint, the choice, and the outcome.
            </p>
          </div>
        </section>

        <section className="guide-reading-section page-container" aria-labelledby="take-home-passes-heading">
          <header className="guide-section-heading">
            <p className="section-kicker">Five review passes</p>
            <h2 id="take-home-passes-heading">Build one technical story.</h2>
            <p>
              Each pass answers a question the interviewer is likely to ask. Together they create
              a concise route from the prompt to your next improvement.
            </p>
          </header>

          <ol className="guide-reading-order take-home-review-passes">
            {takeHomeReviewPasses.map((step, index) => (
              <li key={step.label}>
                <span className="guide-step-index">{String(index + 1).padStart(2, "0")}</span>
                <div className="guide-step-title">
                  <p>{step.label}</p>
                  <h3>{step.title}</h3>
                </div>
                <code>{step.prompt}</code>
                <p>{step.detail}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="guide-architecture-section" aria-labelledby="take-home-evidence-heading">
          <div className="page-container take-home-evidence-layout">
            <header>
              <p className="section-kicker">Keep the answer honest</p>
              <h2 id="take-home-evidence-heading">Separate file evidence from your rationale.</h2>
              <p>
                Static analysis can show repository structure. It cannot recover the original
                prompt, your rejected alternatives, or the effect of the work in production.
              </p>
            </header>

            <div className="take-home-evidence-layers">
              {takeHomeEvidenceLayers.map((layer) => (
                <section key={layer.label}>
                  <h3>{layer.label}</h3>
                  <ul>
                    {layer.items.map((item) => <li key={item}>{item}</li>)}
                  </ul>
                </section>
              ))}
              <p>
                Use &quot;The repository shows...&quot; for file-backed facts. Use &quot;I chose...&quot;
                for your own reasoning.
              </p>
            </div>
          </div>
        </section>

        <section className="guide-evidence-section page-container" aria-labelledby="take-home-answers-heading">
          <header className="guide-section-heading">
            <p className="section-kicker">Prepare the follow-ups</p>
            <h2 id="take-home-answers-heading">Answer with a constraint, a choice, and proof.</h2>
            <p>
              Keep each answer specific enough to inspect. A clear limitation is stronger than an
              unsupported claim that the assignment is complete.
            </p>
          </header>

          <div className="guide-evidence-language">
            {takeHomeAnswerFrames.map((frame) => (
              <article key={frame.label}>
                <span>{frame.label}</span>
                <blockquote>&quot;{frame.example}&quot;</blockquote>
                <p>{frame.use}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="guide-sample-section page-container" aria-labelledby="take-home-proof-heading">
          <header className="guide-sample-heading">
            <div>
              <p className="section-kicker">Inspect a real result</p>
              <h2 id="take-home-proof-heading">See the file-backed half before you start.</h2>
            </div>
            <p>
              The public FastAPI Candidate Brief shows the reading path, risk signals, commands,
              tests, and evidence boundaries produced from one exact repository commit.
            </p>
          </header>

          <div className="take-home-public-proof">
            <div>
              <span>Exact-commit public example</span>
              <h3>FastAPI full-stack template</h3>
              <p>
                Use the report to rehearse how you would move from a ranked starting file to one
                architecture path, one structural risk signal, and the supporting evidence.
              </p>
            </div>
            <Link href="/examples/fastapi-candidate-brief">
              Inspect the FastAPI Candidate Brief <span aria-hidden="true">→</span>
            </Link>
          </div>

          <p className="guide-product-boundary">
            RepoAtlas reads repository files as text. It does not execute code or call AI. The
            report cannot prove runtime behavior, correctness, or the reasoning behind your choices.
          </p>
        </section>

        <section className="guide-close page-container" aria-labelledby="take-home-close-heading">
          <div>
            <p className="section-kicker">Choose the right practice path</p>
            <h2 id="take-home-close-heading">Match the guide to the interview.</h2>
          </div>
          <div className="guide-close-copy take-home-related-guides">
            <p>
              Use the repository walkthrough guide when the code is unfamiliar. Use the personal
              project guide when the discussion is broader than one submitted assignment.
            </p>
            <Link href="/repository-walkthrough-interview">
              Prepare an unfamiliar repository walkthrough <span aria-hidden="true">→</span>
            </Link>
            <Link href="/how-to-walk-through-a-project-in-an-interview">
              Prepare a personal project walkthrough <span aria-hidden="true">→</span>
            </Link>
          </div>
        </section>
      </article>
    </main>
  );
}
