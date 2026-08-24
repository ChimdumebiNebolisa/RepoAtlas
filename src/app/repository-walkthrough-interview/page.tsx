import type { Metadata } from "next";
import Link from "next/link";
import { GuideComparisonLinks } from "@/components/GuideComparisonLinks";
import { GuideStartPanel } from "@/components/GuideStartPanel";
import { SiteHeader } from "@/components/SiteHeader";
import { analyzeBundledSample } from "@/lib/bundledSample";
import { buildHomepageSamplePreview } from "@/lib/homepageSamplePreview";
import {
  repositoryWalkthroughArchitectureSignals,
  repositoryWalkthroughEvidenceLanguage,
  repositoryWalkthroughMetadata,
  repositoryWalkthroughReadingOrder,
} from "@/lib/repositoryWalkthroughContent";

const canonicalUrl = "https://repo-atlas-phi.vercel.app/repository-walkthrough-interview";

export const metadata: Metadata = {
  title: repositoryWalkthroughMetadata.title,
  description: repositoryWalkthroughMetadata.description,
  alternates: { canonical: canonicalUrl },
  openGraph: {
    title: repositoryWalkthroughMetadata.title,
    description: repositoryWalkthroughMetadata.openGraphDescription,
    type: "article",
    url: canonicalUrl,
  },
};

export default async function RepositoryWalkthroughInterviewPage() {
  const { report } = await analyzeBundledSample();
  const sample = buildHomepageSamplePreview(report);

  return (
    <main className="site-shell guide-page">
      <div className="site-grid" aria-hidden="true" />
      <SiteHeader />

      <article>
        <header className="guide-hero repository-walkthrough-hero page-container">
          <div className="guide-hero-copy">
            <p className="eyebrow">Repository walkthrough interview guide</p>
            <h1>How to walk an interviewer through a repository.</h1>
            <p className="guide-hero-intro">
              Start with a clear route through the code, not a list of folders. Show where control
              enters, how one important path crosses the system, which files support your claims,
              and where the evidence stops.
            </p>
            <GuideStartPanel />
          </div>

          <div className="guide-evidence-map" aria-label="A defensible repository walkthrough">
            <div className="guide-question">
              <span>Interview prompt</span>
              <blockquote>&quot;Where would you start, and how does this system fit together?&quot;</blockquote>
            </div>
            <ol>
              <li><code>README + manifest</code><span>orient</span></li>
              <li><code>entry point</code><span>follow control</span></li>
              <li><code>module boundary</code><span>explain responsibility</span></li>
              <li><code>tests + CI</code><span>show the proof</span></li>
            </ol>
          </div>
        </header>

        <section className="guide-intro page-container" aria-labelledby="guide-evaluation-heading">
          <p className="guide-margin-note">What the interviewer is evaluating</p>
          <div>
            <h2 id="guide-evaluation-heading">Your judgment matters more than file recall.</h2>
            <p>
              A strong walkthrough shows that you can reduce an unfamiliar codebase into a useful
              mental model. The interviewer is listening for how you choose a starting point, how
              you distinguish evidence from inference, and how you communicate tradeoffs without
              claiming more than the repository proves.
            </p>
            <p>
              The first ten minutes should establish one coherent path. You can widen the discussion
              after the interviewer can see the system through that path.
            </p>
          </div>
        </section>

        <section className="guide-reading-section page-container" aria-labelledby="guide-reading-heading">
          <header className="guide-section-heading">
            <p className="section-kicker">The first ten minutes</p>
            <h2 id="guide-reading-heading">Use a reading order you can explain.</h2>
            <p>
              Each step should answer a question the previous step created. That turns repository
              exploration into a reasoned sequence instead of a tour.
            </p>
          </header>

          <ol className="guide-reading-order">
            {repositoryWalkthroughReadingOrder.map((step, index) => (
              <li key={step.title}>
                <span className="guide-step-index">{String(index + 1).padStart(2, "0")}</span>
                <div className="guide-step-title">
                  <p>{step.time}</p>
                  <h3>{step.title}</h3>
                </div>
                <code>{step.files}</code>
                <p>{step.detail}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="guide-architecture-section" aria-labelledby="guide-architecture-heading">
          <div className="page-container guide-architecture-layout">
            <header>
              <p className="section-kicker">Explain the architecture</p>
              <h2 id="guide-architecture-heading">Trace responsibility, not every dependency.</h2>
              <p>
                Architecture is the path between meaningful boundaries. Pick one representative
                request, event, or command and explain how responsibility changes as it moves.
              </p>
            </header>

            <div className="guide-architecture-signals">
              {repositoryWalkthroughArchitectureSignals.map((item) => (
                <article key={item.signal}>
                  <span>{item.signal}</span>
                  <div>
                    <h3>{item.question}</h3>
                    <p>{item.evidence}</p>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="guide-evidence-section page-container" aria-labelledby="guide-evidence-heading">
          <header className="guide-section-heading">
            <p className="section-kicker">Keep every claim defensible</p>
            <h2 id="guide-evidence-heading">Label what you know.</h2>
            <p>
              This language keeps a walkthrough precise when static files cannot answer runtime or
              product questions.
            </p>
          </header>

          <div className="guide-evidence-language">
            {repositoryWalkthroughEvidenceLanguage.map((item) => (
              <article key={item.label}>
                <span>{item.label}</span>
                <blockquote>&quot;{item.example}&quot;</blockquote>
                <p>{item.use}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="guide-sample-section page-container" aria-labelledby="guide-sample-heading">
          <header className="guide-sample-heading">
            <div>
              <p className="section-kicker">A real bundled example</p>
              <h2 id="guide-sample-heading">Turn the method into something you can say.</h2>
            </div>
            <p>This excerpt comes from the same deterministic sample analysis the product opens.</p>
          </header>

          {sample ? (
            <div className="guide-sample-proof">
              <div className="guide-sample-summary">
                <span>30-second walkthrough</span>
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

          <p className="guide-product-boundary">
            <Link href="/examples/fastapi-candidate-brief">
              Compare the method with the exact-commit FastAPI Candidate Brief
            </Link>
            . RepoAtlas reads repository files as text. It does not execute code or call AI. It
            provides deeper analysis for TypeScript/JavaScript, Python, and Java, and keeps
            confidence gaps visible.
          </p>
        </section>

        <section className="guide-close page-container" aria-labelledby="guide-close-heading">
          <div>
            <p className="section-kicker">Risks, tradeoffs, and improvements</p>
            <h2 id="guide-close-heading">End with the next useful question.</h2>
          </div>
          <div className="guide-close-copy">
            <p>
              Treat large, highly connected, or lightly tested files as places to inspect, not as
              confirmed defects. Describe the structural signal, point to the supporting file, and
              say what you would verify before changing anything.
            </p>
            <p>
              Discuss a tradeoff only when a manifest, configuration file, interface, or dependency
              boundary shows the technical choice. The files may show what was selected, but they
              do not prove maintainer intent, rejected alternatives, or production impact.
            </p>
            <div className="guide-answer-formulas">
              <p><strong>30 seconds:</strong> purpose, entry point, one system path, one evidence limit.</p>
              <p><strong>2 minutes:</strong> add architecture boundaries, a risk signal, the test path, and one improvement question.</p>
            </div>
            <GuideComparisonLinks lead="If you are still choosing how to prepare," />
          </div>
        </section>
      </article>
    </main>
  );
}
