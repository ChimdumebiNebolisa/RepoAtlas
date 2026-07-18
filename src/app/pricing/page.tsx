import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";

export const metadata: Metadata = {
  title: "Pricing | RepoAtlas",
  description:
    "Open a free RepoAtlas sample Candidate Brief and see the evidence-backed output before uploading a repository.",
};

const sampleIncludes = [
  "A bundled, read-only Candidate Brief",
  "Reading paths, risk signals, talking points, and evidence references",
  "PDF and PNG preview exports",
  "No repository upload or account required",
];

export default function PricingPage() {
  return (
    <main className="site-shell pricing-shell">
      <div className="site-grid" aria-hidden="true" />
      <SiteHeader current="pricing" />

      <section className="pricing-hero page-container">
        <div className="pricing-intro">
          <p className="eyebrow">Simple starting terms</p>
          <h1>See the Candidate Brief before you upload a repo.</h1>
          <p>
            The bundled RepoAtlas sample is free to open. Inspect the reading path, risk signals,
            talking points, and evidence before deciding whether to analyze your own repository.
          </p>
        </div>

        <article className="pricing-card" aria-labelledby="free-sample-plan">
          <div className="pricing-card-topline">
            <div>
              <p className="pricing-plan-label">Free sample</p>
              <h2 id="free-sample-plan">Candidate Brief preview</h2>
            </div>
            <span className="pricing-signal">Available now</span>
          </div>

          <div className="pricing-price">
            <span>$0</span>
            <small>No account required</small>
          </div>

          <p className="pricing-summary">
            A complete, read-only sample report built from the bundled repository.
          </p>

          <ul className="pricing-features">
            {sampleIncludes.map((item) => (
              <li key={item}>
                <span aria-hidden="true">✓</span>
                {item}
              </li>
            ))}
          </ul>

          <Link className="btn btn-primary pricing-primary-action" href="/#sample-report">
            Open free sample <span aria-hidden="true">→</span>
          </Link>
        </article>
      </section>

      <section className="pricing-next-step">
        <div className="page-container pricing-next-step-layout">
          <div>
            <p className="section-kicker">Use your own repository</p>
            <h2>Move from the sample to your codebase.</h2>
          </div>
          <div>
            <p>
              Upload a zip up to 4 MB on the hosted site, or paste a public GitHub URL. RepoAtlas
              reads repository files as text and never executes uploaded code.
            </p>
            <Link className="pricing-text-link" href="/#analyze">
              Go to the analyzer <span aria-hidden="true">→</span>
            </Link>
          </div>
        </div>
      </section>

      <footer className="site-footer page-container">
        <span>RepoAtlas</span>
        <span>Deterministic repository analysis. No code execution. No AI calls.</span>
        <a className="tin-credit" href="https://tin.computer">
          <span className="tin-mark" aria-hidden="true" />
          Growth by Tin
        </a>
      </footer>
    </main>
  );
}
