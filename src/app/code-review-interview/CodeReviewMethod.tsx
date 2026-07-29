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

export function CodeReviewMethod() {
  return (
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
  );
}
