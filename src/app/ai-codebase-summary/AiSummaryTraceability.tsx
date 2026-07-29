import Link from "next/link";

const claimChecks = [
  {
    claim: "Entry point",
    evidence: "Look for a manifest script, framework convention, route, or executable main function.",
  },
  {
    claim: "Architecture",
    evidence: "Resolve both ends of an import or dependency path to files in the repository.",
  },
  {
    claim: "Risk signal",
    evidence: "Treat size, churn, coupling, or sparse tests as inspection priorities, not confirmed defects.",
  },
  {
    claim: "Testing",
    evidence: "Check test files, framework configuration, and continuous-integration commands together.",
  },
  {
    claim: "Technical choice",
    evidence: "Use manifests and configuration to show what was selected, without inventing why.",
  },
] as const;

export function AiSummaryTraceability() {
  return (
    <>
      <section className="guide-reading-section page-container" aria-labelledby="claims-heading">
        <header className="guide-section-heading">
          <p className="section-kicker">Verify the claims that shape your answer</p>
          <h2 id="claims-heading">Follow important statements back to files.</h2>
          <p>
            A claim becomes useful in an interview when you can show the evidence and state its
            limit. For the complete reading method, use the{" "}
            <Link href="/repository-walkthrough-interview">repository walkthrough interview guide</Link>.
          </p>
        </header>

        <ol className="comparison-workflow ai-summary-claim-checks">
          {claimChecks.map((item, index) => (
            <li key={item.claim}>
              <span className="guide-step-index">{String(index + 1).padStart(2, "0")}</span>
              <div>
                <p>Check</p>
                <h3>{item.claim}</h3>
              </div>
              <p>{item.evidence}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="guide-architecture-section" aria-labelledby="unknown-heading">
        <div className="page-container comparison-answer-layout">
          <header>
            <p className="section-kicker">Keep the unknowns visible</p>
            <h2 id="unknown-heading">Repository evidence cannot tell your story.</h2>
            <p>
              Files can support technical facts. They cannot establish a person&apos;s authorship,
              the reason behind a decision, or the result in production.
            </p>
          </header>

          <div className="comparison-answer-depths">
            <article>
              <span>You supply</span>
              <h3>Contribution and constraints</h3>
              <p>Name what you owned, what the task required, and which limits shaped your work.</p>
            </article>
            <article>
              <span>You explain</span>
              <h3>Rationale and rejected alternatives</h3>
              <p>Describe why you chose an approach. Do not ask the repository to prove intent.</p>
            </article>
            <article>
              <span>You verify</span>
              <h3>Runtime behavior and outcomes</h3>
              <p>Use measurements, logs, or your direct experience instead of inferring results from structure.</p>
            </article>
          </div>
        </div>
      </section>

      <section className="ai-summary-checklist-section page-container" aria-labelledby="checklist-heading">
        <header className="guide-section-heading">
          <p className="section-kicker">Before you choose a tool</p>
          <h2 id="checklist-heading">Verify the product&apos;s actual boundary.</h2>
          <p>
            Do not assume that every AI repository tool handles code, citations, or storage the
            same way. Read the product&apos;s current documentation and terms.
          </p>
        </header>

        <ul className="ai-summary-tool-checklist">
          <li>
            <span>01</span>
            <div>
              <h3>Repository access</h3>
              <p>Which public and private repository sources can the product read?</p>
            </div>
          </li>
          <li>
            <span>02</span>
            <div>
              <h3>Code execution</h3>
              <p>Does it read files only, or can it install dependencies and execute repository code?</p>
            </div>
          </li>
          <li>
            <span>03</span>
            <div>
              <h3>Data handling</h3>
              <p>Where is repository content sent, how long is it retained, and who can access it?</p>
            </div>
          </li>
          <li>
            <span>04</span>
            <div>
              <h3>Claim traceability</h3>
              <p>Can you open the exact file or configuration behind each important statement?</p>
            </div>
          </li>
        </ul>
      </section>
    </>
  );
}
