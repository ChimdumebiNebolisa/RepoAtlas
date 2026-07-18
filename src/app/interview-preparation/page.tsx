import type { Metadata } from "next";
import { SiteHeader } from "@/components/SiteHeader";
import { TrackedAnalysisLink } from "@/components/TrackedAnalysisLink";

export const metadata: Metadata = {
  title: "Code Interview Preparation with a Candidate Brief | RepoAtlas",
  description:
    "Turn a repository into an evidence-linked Candidate Brief with a reading path, architecture map, risk signals, and technical talking points.",
  alternates: {
    canonical: "https://repo-atlas-phi.vercel.app/interview-preparation",
  },
  openGraph: {
    title: "Code Interview Preparation with a Candidate Brief | RepoAtlas",
    description:
      "Prepare to explain a repository with a file-backed reading path, architecture map, risk signals, and technical talking points.",
    type: "website",
    url: "https://repo-atlas-phi.vercel.app/interview-preparation",
  },
};

const briefSections = [
  {
    number: "01",
    title: "A reading path",
    description: "Start with the files most connected to entry points, imports, and repository signals.",
  },
  {
    number: "02",
    title: "A walkthrough script",
    description: "Move from the repository shape to architecture, risk areas, and the first change you would make.",
  },
  {
    number: "03",
    title: "Evidence-linked talking points",
    description: "Trace each conclusion back to a file, path, snippet, or detected command.",
  },
] as const;

export default function InterviewPreparationPage() {
  return (
    <main className="site-shell interview-page">
      <div className="site-grid" aria-hidden="true" />
      <SiteHeader />

      <section className="interview-hero page-container">
        <div className="interview-hero-copy">
          <p className="eyebrow">Repository interview preparation</p>
          <h1>Prepare to explain your code, file by file.</h1>
          <p className="interview-hero-description">
            When the conversation turns to your repository, use a Candidate Brief to find the
            reading path, architecture, risk signals, and talking points the code can support.
          </p>
          <TrackedAnalysisLink>Prepare my Candidate Brief</TrackedAnalysisLink>
          <p className="interview-hero-note">
            Start with the bundled sample, a public GitHub URL, or a ZIP. RepoAtlas reads files
            without executing code or calling AI.
          </p>
        </div>

        <div className="candidate-moment" aria-label="Example technical interview moment">
          <div className="candidate-moment-header">
            <span>Technical interview</span>
            <span className="candidate-moment-time">Tomorrow · 10:00</span>
          </div>
          <blockquote>&quot;Walk me through this repository. Where would you start?&quot;</blockquote>
          <div className="candidate-answer-path">
            <span>Answer from evidence</span>
            <ol>
              <li><code>src/app/(homepage)/page.tsx</code><small>application entry</small></li>
              <li><code>src/app/api/analyze/route.ts</code><small>analysis boundary</small></li>
              <li><code>src/analyzer/pipeline.ts</code><small>core workflow</small></li>
            </ol>
          </div>
          <p>Candidate Brief · reading path</p>
        </div>
      </section>

      <section className="interview-outcome page-container">
        <header>
          <p className="section-kicker">What you take into the conversation</p>
          <h2>A technical story you can point back to.</h2>
          <p>
            RepoAtlas organizes detected repository signals. It does not invent business logic,
            assert bugs, or promise what the code cannot prove.
          </p>
        </header>

        <div className="interview-brief-list">
          {briefSections.map((section) => (
            <article key={section.number}>
              <span>{section.number}</span>
              <div>
                <h3>{section.title}</h3>
                <p>{section.description}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="interview-proof-band">
        <div className="page-container interview-proof-layout">
          <p>Built for a high-pressure code conversation.</p>
          <ul aria-label="Candidate Brief safeguards">
            <li>Deterministic static analysis</li>
            <li>TS/JS, Python, and Java</li>
            <li>Confidence gaps stay visible</li>
          </ul>
        </div>
      </section>
    </main>
  );
}
