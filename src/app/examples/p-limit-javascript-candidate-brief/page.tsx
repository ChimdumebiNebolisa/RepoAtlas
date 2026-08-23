import type { Metadata } from "next";
import Link from "next/link";
import { CandidateBriefPanel } from "@/components/CandidateBriefPanel";
import { SiteHeader } from "@/components/SiteHeader";
import capturedOutput from "@/data/examples/p-limit-candidate-brief.json";
import type { CandidateBrief } from "@/types/report";

const canonicalUrl =
  "https://repo-atlas-phi.vercel.app/examples/p-limit-javascript-candidate-brief";
const repositoryUrl = "https://github.com/sindresorhus/p-limit";
const commit = "df476048d023ff868cd45b35ee47f5fb0ca2b25a";
const sourceBaseUrl = `${repositoryUrl}/blob/${commit}/`;

const title = "p-limit JavaScript Candidate Brief Example | RepoAtlas";
const description =
  "Read a complete, exact-commit Candidate Brief for p-limit with all eight interview sections and links to the JavaScript and TypeScript source evidence behind each claim.";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: canonicalUrl },
  openGraph: { title, description, type: "article", url: canonicalUrl },
};

const sectionNames = [
  "Repo Summary",
  "Walkthrough Script",
  "Reading Path",
  "System Flow",
  "Interview Talking Points",
  "Interview Questions",
  "First PR Plan",
  "Evidence",
] as const;

const candidateBrief = capturedOutput.candidate_brief as CandidateBrief;

export default function PLimitJavascriptCandidateBriefExamplePage() {
  return (
    <main className="site-shell guide-page example-page click-example-page">
      <div className="site-grid" aria-hidden="true" />
      <SiteHeader />

      <article>
        <header className="guide-hero example-hero click-example-hero page-container">
          <div className="guide-hero-copy example-hero-copy click-example-hero-copy">
            <p className="eyebrow">JavaScript and TypeScript repository example</p>
            <h1>A Candidate Brief for p-limit, pinned to one commit.</h1>
            <p>
              RepoAtlas analyzed the public p-limit package without running its code. Every file
              claim below opens the exact revision that produced this brief.
            </p>
            <Link
              className="report-action report-action-primary click-example-primary"
              href="/?source=p_limit_example#analyze"
            >
              Analyze your repository
            </Link>
          </div>

          <aside
            className="comparison-entrance example-snapshot click-example-snapshot"
            aria-label="Captured report details"
          >
            <span>Captured output</span>
            <h2>p-limit</h2>
            <dl>
              <div>
                <dt>Repository</dt>
                <dd>
                  <a href={repositoryUrl}>sindresorhus/p-limit</a>
                </dd>
              </div>
              <div>
                <dt>Commit</dt>
                <dd>
                  <a href={`${repositoryUrl}/tree/${commit}`}>{commit}</a>
                </dd>
              </div>
              <div>
                <dt>Analyzed</dt>
                <dd>2026-08-23 08:43 UTC</dd>
              </div>
              <div>
                <dt>Report label</dt>
                <dd>JavaScript package with TypeScript declarations</dd>
              </div>
            </dl>
            <ol className="click-example-section-list" aria-label="Candidate Brief sections">
              {sectionNames.map((name, index) => (
                <li key={name}>
                  <span>{String(index + 1).padStart(2, "0")}</span>
                  {name}
                </li>
              ))}
            </ol>
          </aside>
        </header>

        <section className="click-example-report page-container" aria-labelledby="brief-heading">
          <header className="guide-section-heading click-example-report-heading">
            <p className="section-kicker">Exact analyzer output</p>
            <h2 id="brief-heading">All eight Candidate Brief sections.</h2>
            <p>
              The evidence section keeps the analyzer&apos;s limits visible and links each file signal
              to commit {commit.slice(0, 7)}.
            </p>
          </header>

          <div className="click-example-report-frame">
            <CandidateBriefPanel
              candidateBrief={candidateBrief}
              reportVariant="preview"
              sourceBaseUrl={sourceBaseUrl}
            />
          </div>
        </section>
      </article>
    </main>
  );
}
