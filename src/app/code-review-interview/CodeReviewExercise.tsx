const reviewFindings = [
  {
    priority: "P1",
    title: "The input contract is not enforced",
    evidence: "Line 02 accepts a missing user and line 03 reads `user.email` immediately.",
    comment:
      "Could this path receive an unauthenticated request? If yes, I would return a clear client error before reading the email. A focused test for a missing user would protect that contract.",
    why: "It begins with an observable failure path and asks a scope question before prescribing a fix.",
  },
  {
    priority: "P1",
    title: "A failed write can be reported as success",
    evidence: "Line 08 does not await `saveInvite`, but line 10 returns a success response.",
    comment:
      "Should the response confirm that the invite was persisted? If so, I would await this call and map its failure to the route’s error contract so callers do not receive a false success.",
    why: "It connects one exact line to customer-visible behavior and a testable correction.",
  },
  {
    priority: "P2",
    title: "Normalization happens after the duplicate check",
    evidence: "Line 04 checks the raw email while line 06 lowercases it.",
    comment:
      "I would normalize once before the lookup and write. Otherwise `Dev@Example.com` and `dev@example.com` may take different paths depending on the store. Is email matching intended to be case-insensitive here?",
    why: "It explains the counterexample and leaves room for the system’s actual identity rules.",
  },
];

export function CodeReviewExercise() {
  return (
    <>
      <section className="code-review-example-section" aria-labelledby="code-review-example-heading">
        <div className="page-container code-review-example-layout">
          <header>
            <p className="section-kicker">Worked code review example</p>
            <h2 id="code-review-example-heading">Turn lines of code into ranked feedback.</h2>
            <p>
              Assume this route should create one invite for an authenticated user and report
              whether the write succeeded. The snippet is intentionally small. The goal is to
              show how to move from observation to a review comment an author can act on.
            </p>
          </header>

          <pre aria-label="TypeScript code review exercise">
            <code>{`01 export async function invite(request: Request) {
02   const user = await currentUser(request)
03   const email = user.email
04   const existing = await findInvite(email)
05   if (existing) return { status: 409 }
06   const normalized = email.toLowerCase()
07
08   saveInvite({ email: normalized })
09
10   return { status: 201 }
11 }`}</code>
          </pre>
        </div>
      </section>

      <section className="code-review-findings-section page-container" aria-labelledby="code-review-findings-heading">
        <header className="guide-section-heading">
          <p className="section-kicker">Example review comments</p>
          <h2 id="code-review-findings-heading">State the evidence before the recommendation.</h2>
          <p>
            Each comment below contains four parts: the observed line, a plausible consequence,
            a question that checks the contract, and a bounded next step. That structure keeps
            feedback specific without pretending the snippet proves more than it does.
          </p>
        </header>

        <div className="code-review-findings">
          {reviewFindings.map((finding) => (
            <article key={finding.title}>
              <div className="code-review-finding-heading">
                <span>{finding.priority}</span>
                <h3>{finding.title}</h3>
              </div>
              <p className="code-review-finding-evidence">{finding.evidence}</p>
              <blockquote>&quot;{finding.comment}&quot;</blockquote>
              <p>{finding.why}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="code-review-priority-section" aria-labelledby="code-review-priority-heading">
        <div className="page-container code-review-priority-layout">
          <header>
            <p className="section-kicker">How to prioritize</p>
            <h2 id="code-review-priority-heading">Use impact and evidence, not confidence theater.</h2>
            <p>
              Severity labels vary between teams. Your reasoning matters more than the label. Put
              findings in the order you would want the author to address them.
            </p>
          </header>
          <div className="code-review-priority-grid">
            <article>
              <span>01 / behavior</span>
              <h3>Can it return the wrong result, lose data, or fail without recovery?</h3>
              <p>
                Lead with a concrete triggering case. If the consequence depends on deployment
                or traffic you cannot see, say what you would verify.
              </p>
            </article>
            <article>
              <span>02 / contract</span>
              <h3>Does the change disagree with a type, test, caller, or documented rule?</h3>
              <p>
                A visible contract gives you stronger footing than a personal convention. Cite
                the file or test that establishes it.
              </p>
            </article>
            <article>
              <span>03 / maintainability</span>
              <h3>Will this make the next correct change harder?</h3>
              <p>
                Explain the future edit that becomes risky or repetitive. Avoid asking for a
                refactor only because you prefer another shape.
              </p>
            </article>
            <article>
              <span>04 / polish</span>
              <h3>Is this optional feedback that should not block the change?</h3>
              <p>
                Label minor naming, formatting, or local simplification as optional. A review is
                clearer when preference does not compete with correctness.
              </p>
            </article>
          </div>
        </div>
      </section>
    </>
  );
}
