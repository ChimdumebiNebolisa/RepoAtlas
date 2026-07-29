import type { Metadata } from "next";
import Link from "next/link";
import { GuideComparisonLinks } from "@/components/GuideComparisonLinks";
import { GuideStartPanel } from "@/components/GuideStartPanel";
import { SiteHeader } from "@/components/SiteHeader";
import { analyzeBundledSample } from "@/lib/bundledSample";
import {
  authoredProjectAnswerSequence,
  authoredProjectEvidenceLayers,
  authoredProjectFollowUps,
  authoredProjectWalkthroughMetadata,
} from "@/lib/authoredProjectWalkthroughContent";
import { buildHomepageSamplePreview } from "@/lib/homepageSamplePreview";

const canonicalUrl =
  "https://repo-atlas-phi.vercel.app/how-to-walk-through-a-project-in-an-interview";

export const metadata: Metadata = {
  title: authoredProjectWalkthroughMetadata.title,
  description: authoredProjectWalkthroughMetadata.description,
  alternates: { canonical: canonicalUrl },
  openGraph: {
    title: authoredProjectWalkthroughMetadata.title,
    description: authoredProjectWalkthroughMetadata.openGraphDescription,
    type: "article",
    url: canonicalUrl,
  },
};

export default async function AuthoredProjectWalkthroughPage() {
  const { report } = await analyzeBundledSample();
  const sample = buildHomepageSamplePreview(report);

  return (
    <main className="site-shell guide-page authored-guide-page">
      <div className="site-grid" aria-hidden="true" />
      <SiteHeader />

      <article>
        <header className="guide-hero authored-guide-hero page-container">
          <div className="guide-hero-copy authored-guide-hero-copy">
            <p className="eyebrow">Personal project interview guide</p>
            <h1>How to walk through a project in an interview</h1>
            <p>
              Build a clear story from your contribution, your decisions, and the repository
              evidence that supports the technical explanation.
            </p>
            <GuideStartPanel
              ariaLabel="Start an authored-project brief"
              heading="Add the file-backed structure."
              description="RepoAtlas supplies entry points, architecture, tests, and evidence. You supply the rationale, constraints, and outcomes."
            />
          </div>

          <div className="authored-answer-map" aria-label="The two sources behind a defensible project answer">
            <p>One defensible answer</p>
            <div className="authored-answer-source authored-answer-source-person">
              <span>You explain</span>
              <strong>Problem, contribution, rationale, outcome</strong>
            </div>
            <div className="authored-answer-join" aria-hidden="true">
              <span>+</span>
            </div>
            <div className="authored-answer-source">
              <span>The files support</span>
              <strong>Entry point, architecture, tests, evidence</strong>
            </div>
            <blockquote>
              &quot;Here is what I built, why I chose it, and where the code supports the
              explanation.&quot;
            </blockquote>
          </div>
        </header>

        <section className="guide-intro page-container" aria-labelledby="authored-project-choice-heading">
          <p className="guide-margin-note">Choose the right project</p>
          <div>
            <h2 id="authored-project-choice-heading">Pick a project with decisions you can defend.</h2>
            <p>
              The best example is not always the largest or most polished. Choose work where you can
              explain the problem, your contribution, one meaningful technical decision, an obstacle,
              and what changed because of the work.
            </p>
            <p>
              For a team project, name the boundary of your contribution early. For a take-home,
              explain the assumptions you made and the limit you would address with more time.
            </p>
          </div>
        </section>

        <section className="guide-reading-section page-container" aria-labelledby="authored-answer-heading">
          <header className="guide-section-heading">
            <p className="section-kicker">Build the answer</p>
            <h2 id="authored-answer-heading">Move from context to evidence.</h2>
            <p>
              Each part earns the next. The sequence keeps your answer focused while leaving room for
              the interviewer to go deeper.
            </p>
          </header>

          <ol className="guide-reading-order authored-answer-sequence">
            {authoredProjectAnswerSequence.map((step, index) => (
              <li key={step.title}>
                <span className="guide-step-index">{String(index + 1).padStart(2, "0")}</span>
                <div className="guide-step-title">
                  <p>{step.label}</p>
                  <h3>{step.title}</h3>
                </div>
                <p className="authored-step-prompt">{step.prompt}</p>
                <p>{step.detail}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="guide-architecture-section" aria-labelledby="authored-ownership-heading">
          <div className="page-container authored-ownership-layout">
            <header>
              <p className="section-kicker">Keep authorship honest</p>
              <h2 id="authored-ownership-heading">Separate your intent from file evidence.</h2>
              <p>
                Static analysis can show structure. It cannot know why you made a decision, which
                alternatives you rejected, or what happened in production. Your explanation supplies
                that context.
              </p>
            </header>

            <div className="authored-evidence-layers">
              {authoredProjectEvidenceLayers.map((layer) => (
                <section key={layer.label}>
                  <h3>{layer.label}</h3>
                  <ul>
                    {layer.items.map((item) => <li key={item}>{item}</li>)}
                  </ul>
                </section>
              ))}
              <p>
                Link the two layers with precise language: &quot;I chose this because...&quot; for
                your rationale, and &quot;The repository shows...&quot; for file-backed facts.
              </p>
            </div>
          </div>
        </section>

        <section className="authored-timing-section page-container" aria-labelledby="authored-timing-heading">
          <header className="guide-section-heading">
            <p className="section-kicker">Control the depth</p>
            <h2 id="authored-timing-heading">Prepare a short answer and a deep path.</h2>
          </header>

          <div className="authored-timing-layout">
            <article>
              <span>30 seconds</span>
              <h3>Give the frame.</h3>
              <p>
                Name the problem, your contribution, the system&apos;s job, and the result or current
                limit. Stop before implementation detail unless the interviewer asks.
              </p>
              <blockquote>
                &quot;I built [project] for [person or problem]. I owned [contribution]. The core
                path is [input to output], and the result was [supported outcome].&quot;
              </blockquote>
            </article>
            <article>
              <span>2 minutes</span>
              <h3>Open one technical path.</h3>
              <p>
                Add the architecture, one hard decision, the tradeoff, and what you would improve.
                Keep every file reference tied to the story you already framed.
              </p>
              <blockquote>
                &quot;The important boundary is [boundary]. I chose [approach] because [constraint],
                accepted [tradeoff], and would next verify [improvement].&quot;
              </blockquote>
            </article>
          </div>
        </section>

        <section className="guide-evidence-section page-container" aria-labelledby="authored-followup-heading">
          <header className="guide-section-heading">
            <p className="section-kicker">Prepare for the follow-up</p>
            <h2 id="authored-followup-heading">Make the hard questions useful.</h2>
            <p>
              A follow-up is a chance to show how you make decisions, test assumptions, and learn
              from a limitation.
            </p>
          </header>

          <div className="authored-followups">
            {authoredProjectFollowUps.map((item) => (
              <article key={item.question}>
                <h3>{item.question}</h3>
                <p>{item.answer}</p>
              </article>
            ))}
          </div>

          <aside className="authored-take-home-note">
            <span>For a take-home presentation</span>
            <p>
              Start with the brief and your assumptions. Then show one end-to-end path, one decision
              made under the time limit, one test that protects it, and the next improvement you
              intentionally left out. Do not present unfinished work as complete.
            </p>
          </aside>
        </section>

        <section className="guide-sample-section page-container" aria-labelledby="authored-sample-heading">
          <header className="guide-sample-heading">
            <div>
              <p className="section-kicker">Build the file-backed half</p>
              <h2 id="authored-sample-heading">See what repository evidence looks like.</h2>
            </div>
            <p>
              The bundled sample shows the structure RepoAtlas can support. You still supply
              authorship, rationale, constraints, and outcomes for your own project.
            </p>
          </header>

          {sample ? (
            <div className="guide-sample-proof">
              <div className="guide-sample-summary">
                <span>Repository frame</span>
                <blockquote>{sample.walkthrough}</blockquote>
              </div>
              <div className="guide-sample-details">
                <article>
                  <span>Read first</span>
                  <code>{sample.readingStep.path}</code>
                  <p>{sample.readingStep.why}</p>
                </article>
                <article>
                  <span>Architecture evidence</span>
                  <p>{sample.architecture.explanation}</p>
                  {sample.architecture.evidence?.path ? <code>{sample.architecture.evidence.path}</code> : null}
                </article>
                <article>
                  <span>Prepare for the follow-up</span>
                  <h3>{sample.interviewerQuestion.question}</h3>
                  <p>{sample.interviewerQuestion.rationale}</p>
                </article>
              </div>
            </div>
          ) : (
            <p className="guide-sample-unavailable">
              The bundled report does not contain enough evidence for this preview. Open the sample
              to inspect the available repository signals.
            </p>
          )}

          <div className="guide-sample-action">
            <div>
              <h3>Practice with the bundled repository.</h3>
              <p>
                Open the complete Candidate Brief and identify which technical claims the files can
                support. No upload is needed.
              </p>
            </div>
            <Link className="btn btn-secondary guide-primary-action" href="/?source=interview_preparation&sample=1#analyze">
              Run the bundled sample <span aria-hidden="true">→</span>
            </Link>
          </div>
          <p className="guide-product-boundary">
            RepoAtlas reads repository files as text. It does not execute code or call AI. It
            provides deeper analysis for TypeScript/JavaScript, Python, and Java, and keeps
            confidence gaps visible.
          </p>
        </section>

        <section className="guide-close page-container" aria-labelledby="authored-close-heading">
          <div>
            <p className="section-kicker">A strong close</p>
            <h2 id="authored-close-heading">Say what you would change next.</h2>
          </div>
          <div className="guide-close-copy">
            <p>
              Name one limitation that matters, not a vague wish to polish the project. Explain who
              feels it, what evidence you would collect, and the smallest change you would test.
            </p>
            <p>
              If the interviewer asks about a choice the files do not explain, say so. You can
              describe your own intent. RepoAtlas can support the structural half of the answer, but
              it cannot recover your reasoning from code alone.
            </p>
            <GuideComparisonLinks lead="Before adding your own rationale, choose the preparation method that fits." />
          </div>
        </section>
      </article>
    </main>
  );
}
