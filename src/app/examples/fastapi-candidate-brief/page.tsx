import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";

const canonicalUrl = "https://repo-atlas-phi.vercel.app/examples/fastapi-candidate-brief";
const repositoryUrl = "https://github.com/fastapi/full-stack-fastapi-template";
const commit = "c350936d2888ef16ff4f5549684fd8db54935a89";

const title = "FastAPI Candidate Brief Example | RepoAtlas";
const description =
  "Inspect a production RepoAtlas Candidate Brief captured from FastAPI's public full-stack template at an exact commit.";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: canonicalUrl },
  openGraph: { title, description, type: "article", url: canonicalUrl },
};

const sourceUrl = (path: string) => `${repositoryUrl}/blob/${commit}/${path}`;

const readingPath = [
  {
    path: "backend/app/api/main.py",
    reason: "Priority 100: common entry file and detected entrypoint.",
  },
  {
    path: "backend/app/main.py",
    reason: "Priority 100: common entry file and detected entrypoint.",
  },
  {
    path: "backend/app/alembic/README",
    reason: "Priority 21: root README documentation for the migration boundary.",
  },
] as const;

const riskSignals = [
  {
    path: "frontend/src/client/client/utils.gen.ts",
    score: 90,
    detail: "5,927 bytes, 2 incoming and 5 outgoing file links, complexity 151, and no nearby tests.",
  },
  {
    path: "frontend/src/client/core/serverSentEvents.gen.ts",
    score: 88,
    detail: "7,204 bytes, 2 incoming and 1 outgoing file link, complexity 124, and no nearby tests.",
  },
  {
    path: "frontend/src/client/sdk.gen.ts",
    score: 85,
    detail: "14,886 bytes, 1 incoming and 3 outgoing file links, complexity 81, and no nearby tests.",
  },
] as const;

export default function FastApiCandidateBriefExamplePage() {
  return (
    <main className="site-shell guide-page example-page">
      <div className="site-grid" aria-hidden="true" />
      <SiteHeader />

      <article>
        <header className="guide-hero example-hero page-container">
          <div className="guide-hero-copy example-hero-copy">
            <p className="eyebrow">Public repository example</p>
            <h1>
              FastAPI Candidate Brief for the full-stack template at commit {commit.slice(0, 7)}.
            </h1>
            <p>
              This is a dated production snapshot from one exact public commit. It shows the
              reading route, structural risk signals, architecture context, and confidence limits
              RepoAtlas produced without executing repository code.
            </p>
          </div>

          <aside className="comparison-entrance example-snapshot" aria-label="Captured report details">
            <span>Captured output</span>
            <h2>Full Stack FastAPI Template</h2>
            <dl>
              <div>
                <dt>Repository</dt>
                <dd><a href={repositoryUrl}>fastapi/full-stack-fastapi-template</a></dd>
              </div>
              <div>
                <dt>Commit</dt>
                <dd><a href={`${repositoryUrl}/tree/${commit}`}>{commit}</a></dd>
              </div>
              <div>
                <dt>Analyzed</dt>
                <dd>2026-08-14 12:17 UTC</dd>
              </div>
              <div>
                <dt>Report label</dt>
                <dd>Python project</dd>
              </div>
              <div>
                <dt>Confidence</dt>
                <dd>Medium, with analyzer warnings shown below</dd>
              </div>
            </dl>
          </aside>
        </header>

        <section className="comparison-proof-section page-container" aria-labelledby="snapshot-heading">
          <header className="guide-section-heading">
            <p className="section-kicker">What production returned</p>
            <h2 id="snapshot-heading">A compact map before the file-by-file detail.</h2>
            <p>
              RepoAtlas found 12 ranked starting files, 127 structural risk signals, 8 run
              commands, 23 test files, and an architecture view with 35 nodes and 22 supported
              edges.
            </p>
          </header>

          <div className="comparison-proof-grid">
            <article>
              <span>30-second route</span>
              <h3>Start at the backend API entrypoint.</h3>
              <p>“Python project: Full Stack FastAPI Template. Start at backend/app/api/main.py, validate with npm run dev.”</p>
            </article>
            <article>
              <span>Architecture</span>
              <h3>35 nodes, 22 supported edges.</h3>
              <p>The semantic summary also recorded 93 internal, 194 external, and 204 unresolved edges.</p>
            </article>
            <article>
              <span>Commands</span>
              <h3>Eight source-backed commands.</h3>
              <p><code>npm run dev</code>, <code>npm run test</code>, and <code>docker compose up</code> are among the extracted routes.</p>
            </article>
          </div>
        </section>

        <section className="example-report-section page-container" aria-labelledby="reading-heading">
          <header className="guide-section-heading">
            <p className="section-kicker">Start Here</p>
            <h2 id="reading-heading">The first three files in the captured reading route.</h2>
            <p>Each item links to the exact repository revision used for this report.</p>
          </header>

          <ol className="comparison-workflow">
            {readingPath.map((item, index) => (
              <li key={item.path}>
                <span className="guide-step-index">{String(index + 1).padStart(2, "0")}</span>
                <div>
                  <p>Read</p>
                  <h3><a href={sourceUrl(item.path)}><code>{item.path}</code></a></h3>
                </div>
                <p>{item.reason}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="example-report-section page-container" aria-labelledby="risk-heading">
          <header className="guide-section-heading">
            <p className="section-kicker">Danger Zones</p>
            <h2 id="risk-heading">Inspection priorities, not defect claims.</h2>
            <p>
              The score combines static signals such as size, file links, complexity, and test
              proximity. It does not prove a bug, vulnerability, or production problem.
            </p>
          </header>

          <ol className="comparison-workflow">
            {riskSignals.map((item, index) => (
              <li key={item.path}>
                <span className="guide-step-index">{String(index + 1).padStart(2, "0")}</span>
                <div>
                  <p>Risk {item.score}/100</p>
                  <h3><a href={sourceUrl(item.path)}><code>{item.path}</code></a></h3>
                </div>
                <p>{item.detail}</p>
              </li>
            ))}
          </ol>

          <div className="example-boundary">
            <span>Evidence boundary</span>
            <h3>The repository name says FastAPI. The analyzer stayed narrower.</h3>
            <p>
              RepoAtlas labeled this repository “Python project.” It did not promote the dependency
              name into a framework classification. The report also warned that architecture was
              reduced from file level and that 204 TypeScript and JavaScript import edges remained
              unresolved. Those limits travel with the proof instead of being hidden.
            </p>
            <p>
              <Link href="/repository-walkthrough-interview">
                Turn this report into an interview walkthrough
              </Link>
              {" "}with a defensible reading order and clear evidence limits.
            </p>
            <p>
              <Link href="/?source=fastapi_example&sample=1#analyze">Open the bundled Candidate Brief</Link>
              {" "}or inspect the{" "}
              <a href={`${repositoryUrl}/tree/${commit}`}>exact source revision</a>.
            </p>
          </div>
        </section>
      </article>
    </main>
  );
}
