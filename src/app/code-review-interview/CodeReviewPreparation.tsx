import Link from "next/link";

const questionAnswers = [
  {
    question: "What is a code review interview?",
    answer:
      "It is a structured exercise in reading, prioritization, and technical communication. You inspect a change, identify evidence-backed concerns, and explain what should happen next. The interviewer is evaluating your reasoning, not the number of comments you produce. A useful review distinguishes behavior-changing issues from questions, maintainability notes, and optional polish.",
  },
  {
    question: "How do you review unfamiliar code under time pressure?",
    answer:
      "I begin with the prompt, types, tests, and call sites so I can write down the intended inputs, outputs, and failure behavior. Then I trace one complete path before exploring edge cases. That order keeps me from reviewing style before I understand the contract. I reserve the final minutes to rank findings and rewrite each comment so the author can act on it.",
  },
  {
    question: "What did you look for first?",
    answer:
      "I established the behavior contract, then traced one complete path. In the example, the route should create one invite for an authenticated user and report whether the write succeeded. That contract led me to the missing-user path and the unawaited write before I considered naming or refactoring. Starting with observable outcomes gave me a basis for ranking the findings.",
  },
  {
    question: "How did you decide severity?",
    answer:
      "I ranked findings by the strength of the evidence and the consequence in this code path. A missing user can cause a direct failure, and an unawaited write can return success before persistence succeeds. Those behavior-changing paths came before the normalization question. I would state that severity labels vary by team, then explain the ordering instead of defending a label as universal.",
  },
  {
    question: "What kinds of issues should you look for?",
    answer:
      "I look first for incorrect results, lost data, unsafe state changes, missing authorization, and failures that are hidden from callers. Then I compare the change with visible contracts in types, tests, configuration, and call sites. After correctness, I consider maintainability and performance when the code provides direct evidence. Naming and formatting stay optional unless they make the behavior genuinely hard to understand.",
  },
  {
    question: "How do you write a useful review comment?",
    answer:
      "I use four parts: the exact observation, a triggering case, the plausible consequence, and a bounded next step or question. For line 08, I would say that `saveInvite` is not awaited, ask whether the response should confirm persistence, and suggest awaiting the call plus testing the failure path. That gives the author evidence and a direction without pretending I know every system constraint.",
  },
  {
    question: "What would you test?",
    answer:
      "I would add the smallest test that reproduces each disputed behavior: a missing user, a rejected persistence call, and differently cased versions of the same email. I would start with the two behavior-changing paths because they affect whether the route can return the correct result. The email case belongs after the identity rule is confirmed. These tests protect the fix and make the intended contract visible to the next reviewer.",
  },
  {
    question: "Would you approve this change?",
    answer:
      "Not yet. I would ask for the missing-user path and persistence failure to be resolved or explicitly accepted because both can change the route's result. I would keep normalization as a contract question until the repository shows whether email identity is case-insensitive. That answer names the blocking evidence, separates it from uncertainty, and gives the author a clear path back to approval.",
  },
  {
    question: "How do you handle disagreement with the author?",
    answer:
      "I return to the shared contract and the concrete case. If a test, type, caller, or documented rule supports the concern, I cite it. If the disagreement is about an unstated design choice, I ask what constraint I am missing and mark the comment as a question rather than a defect. The goal is to reach the correct change, not to win the review or defend my first reading.",
  },
  {
    question: "What are you least certain about?",
    answer:
      "I cannot infer the authentication boundary, storage guarantees, or email identity rules from this function alone. The comments therefore describe plausible failure paths, not proven production incidents. I would inspect the route's caller, the persistence interface, nearby tests, and the repository's error conventions before widening the claim. Naming that uncertainty shows where the review should go next without weakening the evidence already present.",
  },
];

export function CodeReviewPreparation() {
  return (
    <>
      <section className="code-review-questions-section page-container" aria-labelledby="code-review-questions-heading">
        <header className="guide-section-heading">
          <p className="section-kicker">Code review interview questions and answers</p>
          <h2 id="code-review-questions-heading">Prepare to explain the review, not recite it.</h2>
          <p>
            The discussion often matters as much as the written comments. These example answers
            use the worked invite route above, so each claim has a visible source. Adapt the
            structure to your exercise: name what you observed, explain why it matters, state what
            you would verify, and choose the next action. Do not memorize the wording. Interviewers
            can change the code, but the reasoning pattern still holds.
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
