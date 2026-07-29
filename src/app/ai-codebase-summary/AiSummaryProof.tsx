export function AiSummaryProof() {
  return (
    <section className="comparison-proof-section page-container" aria-labelledby="repoatlas-heading">
      <header className="guide-section-heading">
        <p className="section-kicker">RepoAtlas&apos;s published boundary</p>
        <h2 id="repoatlas-heading">Deterministic, file-backed, and explicit about limits.</h2>
        <p>
          RepoAtlas reads repository files as text. It does not call AI or execute uploaded
          code. The Candidate Brief connects its repository-specific claims to evidence,
          confidence notes, and analyzer warnings.
        </p>
      </header>

      <div className="comparison-proof-grid">
        <article>
          <span>Included</span>
          <h3>Interview-ready structure</h3>
          <p>Entry points, reading order, architecture, risk signals, timed scripts, questions, and evidence.</p>
        </article>
        <article>
          <span>Bounded</span>
          <h3>Static repository evidence</h3>
          <p>Risk scores direct inspection. They are not bug, vulnerability, or runtime findings.</p>
        </article>
        <article>
          <span>Portable</span>
          <h3>Dependable exports</h3>
          <p>PDF and PNG are available. Markdown and saved server links depend on storage.</p>
        </article>
      </div>
    </section>
  );
}
