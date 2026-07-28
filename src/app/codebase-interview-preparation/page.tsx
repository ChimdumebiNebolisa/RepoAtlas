import type { Metadata } from "next";
import Link from "next/link";
import { ComparisonEntrance } from "@/components/ComparisonEntrance";
import { SiteHeader } from "@/components/SiteHeader";
import { analyzeBundledSample } from "@/lib/bundledSample";
import { buildHomepageSamplePreview } from "@/lib/homepageSamplePreview";

const canonicalUrl = "https://repo-atlas-phi.vercel.app/codebase-interview-preparation";

const title = "Structured Codebase Interview Preparation | RepoAtlas";
const description =
  "Compare ad hoc repository browsing with a structured, evidence-first codebase interview preparation workflow you can turn into a verified walkthrough.";

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

const preparationSteps = [
  {
    label: "Scope",
    title: "Name the conversation",
    detail: "Clarify whether you need to explain the whole repository, trace one feature, or discuss a change.",
  },
  {
    label: "Orient",
    title: "Find the repository contract",
    detail: "Read the README, manifests, scripts, and configuration as claims to verify against the code.",
  },
  {
    label: "Trace",
    title: "Follow one important path",
    detail: "Move from a likely entry point through meaningful module boundaries to state or output.",
  },
  {
    label: "Check",
    title: "Inspect tests and risk signals",
    detail: "Use tests, CI, and highly connected files to decide where to look closer, not to declare defects.",
  },
  {
    label: "Draft",
    title: "Build two timed answers",
    detail: "Reduce the same evidence into a 30-second orientation and a two-minute technical walkthrough.",
  },
  {
    label: "Verify",
    title: "Resolve every claim to a file",
    detail: "Mark statements as observed, inferred, or unknown before you practice saying them aloud.",
  },
];

export default async function CodebaseInterviewPreparationPage() {
  const { report } = await analyzeBundledSample();
  const sample = buildHomepageSamplePreview(report);

  return (
    <main className="site-shell guide-page comparison-page">
      <div className="site-grid" aria-hidden="true" />
      <SiteHeader />

      <article>
        <header className="guide-hero comparison-hero page-container">
          <div className="guide-hero-copy comparison-hero-copy">
            <p className="eyebrow">Codebase interview preparation</p>
            <h1>Prepare a route through the code, not a pile of notes.</h1>
            <p>
              Ad hoc browsing can answer a focused question. A structured pass helps when you need
              to explain an unfamiliar repository, show where each claim came from, and control the
              depth of the conversation.
            </p>
          </div>

          <ComparisonEntrance sample={sample} variant="structured-preparation" />
        </header>

        <div className="comparison-route-section page-container">
          <div className="comparison-route-map" aria-label="Ad hoc and structured preparation paths">
            <p>Two useful preparation modes</p>
            <div className="comparison-route">
              <span>Ad hoc pass</span>
              <strong>Follow the immediate question</strong>
              <small>Good for a familiar codebase or one narrow follow-up.</small>
            </div>
            <div className="comparison-route comparison-route-structured">
              <span>Structured pass</span>
              <strong>Build a verified reading route</strong>
              <small>Useful when the repository is unfamiliar and the conversation can widen.</small>
            </div>
            <div className="comparison-route-join">
              <span>Use both</span>
              <p>Explore freely, then organize the evidence you need to defend.</p>
            </div>
          </div>
        </div>

        <section className="guide-intro page-container" aria-labelledby="prepared-heading">
          <p className="guide-margin-note">What prepared means</p>
          <div>
            <h2 id="prepared-heading">You can explain your route and its limits.</h2>
            <p>
              Preparation is not memorizing every folder. It is choosing a starting point, tracing
              one representative path, and knowing which files support your explanation.
            </p>
            <p>
              A useful result is a short walkthrough you can expand under questioning. It should
              separate repository facts from your interpretation and leave runtime, product, and
              maintainer-intent gaps visible.
            </p>
          </div>
        </section>

        <section className="comparison-choice-section page-container" aria-labelledby="choice-heading">
          <header className="guide-section-heading">
            <p className="section-kicker">Choose the lighter method that works</p>
            <h2 id="choice-heading">Ad hoc is enough more often than it sounds.</h2>
            <p>
              The methods are not rivals. The right choice depends on how familiar the repository
              is, how broad the prompt is, and how much of your answer must be verified.
            </p>
          </header>

          <div className="comparison-choice-grid">
            <article>
              <span>Ad hoc browsing works when</span>
              <h3>The question is already narrow.</h3>
              <ul>
                <li>You know the codebase and need to refresh one path.</li>
                <li>The interviewer has named the feature, file, or change.</li>
                <li>Your notes only need to support a short follow-up.</li>
              </ul>
              <p>Watch for disconnected notes that do not add up to one speakable explanation.</p>
            </article>

            <article className="comparison-choice-structured">
              <span>A structured pass helps when</span>
              <h3>The conversation can move across the system.</h3>
              <ul>
                <li>The repository is unfamiliar or large enough to lose your place.</li>
                <li>You need a reading order, architecture path, tests, and tradeoff evidence.</li>
                <li>You want the same facts to support both a short and a detailed answer.</li>
              </ul>
              <p>Keep the process bounded. Structure should reduce the codebase, not catalogue it.</p>
            </article>
          </div>
        </section>

        <section className="guide-reading-section page-container" aria-labelledby="workflow-heading">
          <header className="guide-section-heading">
            <p className="section-kicker">A repeatable evidence-first pass</p>
            <h2 id="workflow-heading">Turn repository exploration into an answer.</h2>
            <p>
              Each step creates the input for the next one. For the complete unfamiliar-repository
              method, use the{" "}
              <Link href="/repository-walkthrough-interview">repository walkthrough interview guide</Link>.
            </p>
          </header>

          <ol className="comparison-workflow">
            {preparationSteps.map((step, index) => (
              <li key={step.label}>
                <span className="guide-step-index">{String(index + 1).padStart(2, "0")}</span>
                <div>
                  <p>{step.label}</p>
                  <h3>{step.title}</h3>
                </div>
                <p>{step.detail}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="guide-architecture-section" aria-labelledby="answer-heading">
          <div className="page-container comparison-answer-layout">
            <header>
              <p className="section-kicker">From notes to spoken answers</p>
              <h2 id="answer-heading">Use one evidence set at two depths.</h2>
              <p>
                The short answer orients the interviewer. The longer answer follows one system path
                and adds the proof, risk signal, and open question that make your judgment visible.
              </p>
            </header>

            <div className="comparison-answer-depths">
              <article>
                <span>30 seconds</span>
                <h3>Purpose, entry point, path, limit.</h3>
                <p>Give the interviewer a map they can hold before they choose where to go deeper.</p>
              </article>
              <article>
                <span>2 minutes</span>
                <h3>Add boundaries, tests, and one risk signal.</h3>
                <p>Explain why you followed that route and what you would verify before changing it.</p>
              </article>
              <article>
                <span>Your judgment</span>
                <h3>Supply intent and personal rationale.</h3>
                <p>
                  Files can show technical choices. They cannot prove why maintainers chose them,
                  which alternatives they rejected, or what happens in production.
                </p>
              </article>
            </div>
          </div>
        </section>

        <section className="comparison-proof-section page-container" aria-labelledby="proof-heading">
          <header className="guide-section-heading">
            <p className="section-kicker">What a tool can and cannot do</p>
            <h2 id="proof-heading">Let the files carry facts. Keep the judgment yours.</h2>
            <p>
              RepoAtlas reads repository files as text. It does not execute code or call AI. Its
              Candidate Brief organizes file-backed entry points, reading order, architecture,
              structural risk signals, tests, timed walkthroughs, and an evidence index.
            </p>
          </header>

          <div className="comparison-proof-grid">
            <article>
              <span>Repository evidence</span>
              <h3>Support the route</h3>
              <p>Files, manifests, imports, tests, and configuration can ground what you observed.</p>
            </article>
            <article>
              <span>Inspection priorities</span>
              <h3>Direct your next question</h3>
              <p>Large or connected files are places to inspect, not confirmed defects or vulnerabilities.</p>
            </article>
            <article>
              <span>Confidence gaps</span>
              <h3>Stop unsupported claims</h3>
              <p>
                Deeper analysis covers TypeScript and JavaScript, Python, and Java. Other languages
                receive basic inventory with visible limits.
              </p>
            </article>
          </div>
        </section>

        <section className="comparison-next-section page-container" aria-labelledby="next-heading">
          <header>
            <p className="section-kicker">Choose the guide that matches your interview</p>
            <h2 id="next-heading">Keep repository facts and personal rationale separate.</h2>
          </header>
          <div className="comparison-guide-links">
            <Link href="/repository-walkthrough-interview">
              <span>Unfamiliar repository</span>
              <strong>Learn the complete evidence-first walkthrough</strong>
              <small>Reading order, architecture, proof language, and follow-up questions.</small>
            </Link>
            <Link href="/how-to-walk-through-a-project-in-an-interview">
              <span>Your project or take-home</span>
              <strong>Explain what you built and why</strong>
              <small>Contribution, rationale, tradeoffs, testing, and outcomes you can personally defend.</small>
            </Link>
          </div>
        </section>
      </article>
    </main>
  );
}
