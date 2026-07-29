import { GuideStartPanel } from "@/components/GuideStartPanel";

export function CodeReviewHero() {
  return (
    <>
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
    </>
  );
}
