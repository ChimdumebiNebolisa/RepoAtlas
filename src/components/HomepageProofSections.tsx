import {
  homepageFaqItems,
  homepageTrustBoundaries,
} from "@/lib/homepageContent";
import { reportCapabilityCopy } from "@/lib/reportCapabilities";
import type { HomepageFaqItem } from "@/lib/homepageContent";

function Arrow() {
  return <span aria-hidden="true">→</span>;
}

function HomepageFaqAnswer({ answer, link }: Pick<HomepageFaqItem, "answer" | "link">) {
  if (!link) {
    return <p>{answer}</p>;
  }

  const linkStart = answer.indexOf(link.label);

  if (linkStart < 0) {
    return <p>{answer}</p>;
  }

  return (
    <p>
      {answer.slice(0, linkStart)}
      <a href={link.href}>{link.label}</a>
      {answer.slice(linkStart + link.label.length)}
    </p>
  );
}

export function HomepageHero({
  loading,
  onGenerateSample,
}: {
  loading: boolean;
  onGenerateSample: () => void;
}) {
  return (
    <section id="top" className="hero page-container">
      <div className="hero-copy">
        <h1>Turn a repository into an interview-ready brief.</h1>
        <div className="hero-actions">
          <button
            className="btn btn-primary"
            type="button"
            disabled={loading}
            onClick={onGenerateSample}
          >
            {loading ? "Opening sample…" : "Open the sample Candidate Brief"} <Arrow />
          </button>
        </div>
      </div>
    </section>
  );
}

export function HomepageTrustAndFaq() {
  return (
    <section id="faq" className="faq-section homepage-trust" aria-labelledby="homepage-trust-heading">
      <div className="page-container faq-layout">
        <header className="faq-intro">
          <p className="section-kicker">Trust and privacy</p>
          <h2 id="homepage-trust-heading">How RepoAtlas treats your code.</h2>
          <p>{reportCapabilityCopy.homepageStorageNote}</p>
          <ul className="trust-boundary-list">
            {homepageTrustBoundaries.map((item) => <li key={item}>{item}</li>)}
          </ul>
          <a href="/privacy" className="faq-privacy-link">
            Read the privacy details <Arrow />
          </a>
        </header>
        <div className="faq-list">
          {homepageFaqItems.map(({ question, answer, link }) => (
            <details key={question} data-testid="homepage-faq-item">
              <summary>
                <h3>{question}</h3>
              </summary>
              <HomepageFaqAnswer answer={answer} link={link} />
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
