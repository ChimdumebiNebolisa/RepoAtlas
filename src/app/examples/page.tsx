import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";

const canonicalUrl = "https://repo-atlas-phi.vercel.app/examples";
const title = "Candidate Brief Examples by Language | RepoAtlas";
const description =
  "Browse exact-commit Candidate Brief examples for real Python, Java, JavaScript, and TypeScript repositories, with every claim linked to source evidence.";

export const TOOL_PAGE_WORD_CAP = 500;

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: canonicalUrl },
  openGraph: { title, description, type: "website", url: canonicalUrl },
};

const examples = [
  {
    number: "01",
    name: "FastAPI full-stack template",
    repository: "fastapi/full-stack-fastapi-template",
    language: "Python",
    commit: "c350936",
    href: "/examples/fastapi-candidate-brief",
    linkLabel: "Open FastAPI Candidate Brief",
  },
  {
    number: "02",
    name: "Pallets Click",
    repository: "pallets/click",
    language: "Python",
    commit: "2c8cd3a",
    href: "/examples/click-candidate-brief",
    linkLabel: "Open Pallets Click Candidate Brief",
  },
  {
    number: "03",
    name: "Spring Petclinic",
    repository: "spring-projects/spring-petclinic",
    language: "Java",
    commit: "88e37c1",
    href: "/examples/spring-petclinic-candidate-brief",
    linkLabel: "Open Spring Petclinic Candidate Brief",
  },
  {
    number: "04",
    name: "p-limit",
    repository: "sindresorhus/p-limit",
    language: "JavaScript and TypeScript",
    commit: "df47604",
    href: "/examples/p-limit-javascript-candidate-brief",
    linkLabel: "Open p-limit Candidate Brief",
  },
] as const;

export default function ExamplesGalleryPage() {
  return (
    <main className="site-shell examples-gallery-page">
      <div className="site-grid" aria-hidden="true" />
      <SiteHeader />

      <article data-testid="examples-body">
        <header className="examples-gallery-hero page-container">
          <div className="examples-gallery-hero-copy">
            <h1>See how RepoAtlas explains real repositories.</h1>
            <p>
              Choose a public brief to inspect its reading path, architecture context, risk signals,
              and source-linked evidence.
            </p>
            <Link className="report-action report-action-primary examples-gallery-primary" href="#briefs">
              Browse four examples
            </Link>
          </div>

          <aside className="examples-gallery-summary" aria-label="Gallery summary">
            <div>
              <span>Public briefs</span>
              <strong>04</strong>
            </div>
            <dl>
              <div>
                <dt>Python</dt>
                <dd>2 repositories</dd>
              </div>
              <div>
                <dt>Java</dt>
                <dd>1 repository</dd>
              </div>
              <div>
                <dt>JavaScript / TypeScript</dt>
                <dd>1 repository</dd>
              </div>
            </dl>
            <p>Every brief is pinned to the repository revision used for analysis.</p>
          </aside>
        </header>

        <section className="examples-gallery-section page-container" id="briefs" aria-labelledby="briefs-heading">
          <header className="examples-gallery-heading">
            <p className="section-kicker">Public product proof</p>
            <h2 id="briefs-heading">Four repositories. One evidence standard.</h2>
            <p>Each brief keeps its claims tied to files from one exact commit.</p>
          </header>

          <nav
            className="examples-gallery-list"
            aria-label="Candidate Brief examples"
            data-internal-link-group
          >
            {examples.map((example) => (
              <article className="examples-gallery-entry" key={example.href}>
                <span className="examples-gallery-number" aria-hidden="true">{example.number}</span>
                <div className="examples-gallery-repository">
                  <p>{example.language}</p>
                  <h3>{example.name}</h3>
                  <code>{example.repository}</code>
                </div>
                <p className="examples-gallery-status">Exact commit · {example.commit}</p>
                <Link href={example.href} aria-label={example.linkLabel}>
                  {example.linkLabel}
                  <span aria-hidden="true">→</span>
                </Link>
              </article>
            ))}
          </nav>
        </section>
      </article>
    </main>
  );
}
