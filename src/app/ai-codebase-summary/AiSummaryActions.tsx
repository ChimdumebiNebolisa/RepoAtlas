import Link from "next/link";

export function AiSummaryActions() {
  return (
    <section className="comparison-next-section page-container" aria-labelledby="next-heading">
      <header>
        <p className="section-kicker">Continue with the right guide</p>
        <h2 id="next-heading">Prepare the repository facts and your own context.</h2>
      </header>
      <div className="comparison-guide-links">
        <Link href="/repository-walkthrough-interview">
          <span>Unfamiliar repository</span>
          <strong>Learn the complete evidence-first walkthrough</strong>
          <small>Build a reading order, trace architecture, and prepare follow-up questions.</small>
        </Link>
        <Link href="/how-to-walk-through-a-project-in-an-interview">
          <span>Your project or take-home</span>
          <strong>Add contribution, rationale, and outcomes</strong>
          <small>Separate what you know from what the repository can support.</small>
        </Link>
      </div>
    </section>
  );
}
