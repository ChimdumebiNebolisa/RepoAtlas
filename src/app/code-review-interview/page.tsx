import type { Metadata } from "next";
import Link from "next/link";
import { GuideStartPanel } from "@/components/GuideStartPanel";
import { SiteHeader } from "@/components/SiteHeader";

const canonicalUrl = "https://repo-atlas-phi.vercel.app/code-review-interview";

export const metadata: Metadata = {
  title: "Code Review Interview Examples and Preparation Guide | RepoAtlas",
  description:
    "Practice code review interview examples with an evidence-first checklist, sample comments, and a clear way to explain priorities and tradeoffs.",
  alternates: { canonical: canonicalUrl },
  openGraph: {
    title: "Code Review Interview Examples and Preparation Guide | RepoAtlas",
    description:
      "A practical, evidence-first method for finding, prioritizing, and explaining code review feedback in an interview.",
    type: "article",
    url: canonicalUrl,
  },
};

const reviewPasses = [
  {
    time: "0–5 min",
    title: "Establish the contract",
    prompt: "What must this code do?",
    detail:
      "Read the prompt, tests, types, and call sites before judging style. Write down the expected inputs, outputs, failure behavior, and any constraints the interviewer gave you.",
  },
  {
    time: "5–15 min",
    title: "Trace one complete path",
    prompt: "Where can behavior go wrong?",
    detail:
      "Follow data from entry to return value. Mark unchecked assumptions, state changes, external calls, and branches that change the result. This is where correctness findings usually emerge.",
  },
  {
    time: "15–25 min",
    title: "Test the boundaries",
    prompt: "Which case would disprove this?",
    detail:
      "Check empty, missing, duplicate, oversized, concurrent, and failed-dependency cases that are relevant to the code. Prefer one concrete counterexample over a broad claim that the code is unsafe.",
  },
  {
    time: "25–35 min",
    title: "Rank the findings",
    prompt: "What should change first?",
    detail:
      "Separate behavior-changing issues from maintainability notes. Choose the two or three findings with the clearest impact, then keep optional polish in reserve.",
  },
  {
    time: "35–45 min",
    title: "Prepare the conversation",
    prompt: "How would you say this to a teammate?",
    detail:
      "State the observation, show the triggering case, explain the consequence, and propose a bounded change. Name what you would verify instead of pretending the snippet proves production impact.",
  },
];

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

export default function CodeReviewInterviewPage() {
  return (
    <main className="site-shell guide-page">
      <div className="site-grid" aria-hidden="true" />
      <SiteHeader />

      <article>
        <header className="guide-hero page-container code-review-hero">
          <div className="guide-hero-copy code-review-hero-copy">
            <p className="eyebrow">Code review interview examples</p>
            <h1>Review the behavior, then explain your judgment.</h1>
            <p className="guide-hero-intro">
              A code review interview is not a contest to collect the most comments. It tests
              whether you can understand an unfamiliar change, find the issues that matter, and
              discuss them like a teammate. This guide gives you a repeatable 45-minute method,
              one worked example, and language you can use when the evidence is incomplete.
            </p>
            <GuideStartPanel
              ariaLabel="Prepare a repository for a code review interview"
              heading="Practice with a real repository."
              description="Open an evidence-linked Candidate Brief, then use the review method below."
            />
          </div>

          <div className="code-review-packet" aria-label="A prioritized code review packet">
            <p>Review packet / 03 findings</p>
            <div className="code-review-packet-file">
              <span>src/api/invites.ts</span>
              <small>42 changed lines</small>
            </div>
            <ol>
              <li>
                <span>P1</span>
                <strong>False success after failed write</strong>
                <small>behavior · line 08</small>
              </li>
              <li>
                <span>P1</span>
                <strong>Missing input boundary</strong>
                <small>correctness · line 03</small>
              </li>
              <li>
                <span>P2</span>
                <strong>Inconsistent email normalization</strong>
                <small>data contract · lines 04–06</small>
              </li>
            </ol>
            <p className="code-review-packet-note">
              Two blockers, one contract question, zero style-only comments.
            </p>
          </div>
        </header>

        <section className="guide-intro page-container" aria-labelledby="code-review-format-heading">
          <p className="guide-margin-note">What the format evaluates</p>
          <div>
            <h2 id="code-review-format-heading">The deliverable is a useful conversation.</h2>
            <p>
              In a code review interview, you may receive a short pull request, a deliberately
              flawed function, or a repository with a proposed change. You are usually asked to
              read it, leave comments, and discuss your reasoning. The exact format varies, but the
              strongest answers make the same moves: establish intent, trace behavior, test edge
              cases, rank findings, and communicate without overclaiming.
            </p>
            <p>
              Interviewers can see whether you distinguish a blocker from a preference. They can
              also see whether you ask for missing context, connect feedback to a concrete outcome,
              and make the next change easier for the author. A long list of generic best practices
              does not show that judgment.
            </p>
          </div>
        </section>

        <section className="guide-reading-section page-container" aria-labelledby="code-review-method-heading">
          <header className="guide-section-heading">
            <p className="section-kicker">A 45-minute preparation method</p>
            <h2 id="code-review-method-heading">Make five passes, each with one job.</h2>
            <p>
              Re-reading the same file without a question burns time. These passes move from
              contract to evidence to communication, so your final comments reflect priorities
              rather than the order in which you noticed things.
            </p>
          </header>

          <ol className="guide-reading-order code-review-passes">
            {reviewPasses.map((pass, index) => (
              <li key={pass.title}>
                <span className="guide-step-index">{String(index + 1).padStart(2, "0")}</span>
                <div className="guide-step-title">
                  <p>{pass.time}</p>
                  <h3>{pass.title}</h3>
                </div>
                <code>{pass.prompt}</code>
                <p>{pass.detail}</p>
              </li>
            ))}
          </ol>
        </section>

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
              RepoAtlas can turn a public GitHub repository or permitted ZIP into an evidence-linked
              Candidate Brief with reading order, architecture, risk signals, and a pull-request
              discussion path. It reads files as text and does not execute the code or call AI, so
              runtime behavior, author intent, and business impact still require verification.
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
      </article>
    </main>
  );
}
