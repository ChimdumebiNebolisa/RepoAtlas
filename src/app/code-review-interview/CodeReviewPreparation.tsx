import Link from "next/link";

const questionAnswers = [
  {
    question: "What did you look for first?",
    answer:
      "I established the behavior contract, then traced one complete path. That kept me focused on outcomes before style and gave me a basis for ranking the findings.",
  },
  {
    question: "How did you decide severity?",
    answer:
      "I ranked findings by the strength of the evidence and the consequence in this code path. A false success and a direct crash came before naming, duplication, or refactoring ideas.",
  },
  {
    question: "What would you test?",
    answer:
      "I would add the smallest test that reproduces each behavior: a missing user, a rejected persistence call, and differently cased versions of the same email. Those tests also clarify the intended contract.",
  },
  {
    question: "Would you approve this change?",
    answer:
      "Not until the two behavior-changing findings are resolved or explicitly accepted. I would keep the normalization question open until the identity contract is confirmed.",
  },
  {
    question: "What are you least certain about?",
    answer:
      "I cannot infer the authentication boundary, storage guarantees, or email identity rules from this function alone. I would inspect its caller, persistence interface, and nearby tests before widening the claim.",
  },
];

export function CodeReviewPreparation() {
  return (
    <>
      <section className="code-review-questions-section page-container" aria-labelledby="code-review-questions-heading">
        <header className="guide-section-heading">
          <p className="section-kicker">Questions after the review</p>
          <h2 id="code-review-questions-heading">Prepare to defend your decisions.</h2>
          <p>
            The discussion often matters as much as the written comments. These answer shapes
            show a clear process while keeping uncertainty honest.
          </p>
        </header>

        <div className="code-review-questions">
          {questionAnswers.map((item) => (
            <article key={item.question}>
              <h3>{item.question}</h3>
              <p>{item.answer}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="guide-close page-container" aria-labelledby="code-review-close-heading">
        <div>
          <p className="section-kicker">Practice with repository evidence</p>
          <h2 id="code-review-close-heading">Bring a route, not a script.</h2>
        </div>
        <div className="guide-close-copy">
          <p>
            Practice the method on a real repository by choosing one change boundary: an API
            route, command handler, persistence adapter, or pull request discussion. Identify the
            contract, trace one behavior, choose the two findings you would raise first, and note
            the files that support each claim.
          </p>
          <p>
            RepoAtlas can turn a public GitHub repository or permitted ZIP into a Candidate Brief
            with a ranked reading path and file-backed talking points. Use the architecture,
            source-backed commands, test inventory, and structural risk signals to choose what to
            inspect first. RepoAtlas reads files as text and does not execute the code or call AI,
            so runtime behavior, author intent, and business impact still require verification.
            {" "}<Link href="/examples/fastapi-candidate-brief">
              Inspect the public FastAPI Candidate Brief
            </Link>{" "}to see those evidence limits on an exact repository commit.
          </p>
          <div className="guide-answer-formulas">
            <p>
              <strong>Continue with the method:</strong>{" "}
              <Link href="/repository-walkthrough-interview">
                learn how to trace an unfamiliar repository
              </Link>
              .
            </p>
            <p>
              <strong>Compare preparation styles:</strong>{" "}
              <Link href="/codebase-interview-preparation">
                choose between structured preparation and ad hoc browsing
              </Link>
              .
            </p>
          </div>
          <Link className="btn btn-secondary code-review-close-action" href="/?source=interview_preparation#analyze">
            Open the bundled Candidate Brief <span aria-hidden="true">→</span>
          </Link>
        </div>
      </section>
    </>
  );
}
