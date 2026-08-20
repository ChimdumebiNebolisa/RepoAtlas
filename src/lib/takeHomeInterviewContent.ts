export const takeHomeInterviewMetadata = {
  title: "Take-home Coding Interview Review Guide | RepoAtlas",
  description:
    "Review a take-home coding assignment before the interview with a five-pass, file-backed story covering the core path, decisions, tests, limits, and next change.",
  openGraphDescription:
    "Prepare a clear, evidence-backed walkthrough of your take-home coding assignment before the interview.",
} as const;

export const takeHomeReviewPasses = [
  {
    label: "Brief",
    title: "Restate the constraint.",
    prompt: "Prompt, time limit, assumptions",
    detail:
      "Open with the problem you were asked to solve. Name the assumption that shaped your scope and the requirement you treated as most important.",
  },
  {
    label: "Trace",
    title: "Walk one complete path.",
    prompt: "Input, boundary, result",
    detail:
      "Follow one representative input through the main boundary to its result. Use files to keep the explanation concrete and ordered.",
  },
  {
    label: "Defend",
    title: "Explain one decision.",
    prompt: "Choice, alternative, tradeoff",
    detail:
      "Choose a decision that mattered under the time limit. Explain the closest alternative and the cost you accepted.",
  },
  {
    label: "Verify",
    title: "Show the protection.",
    prompt: "Test, command, remaining unknown",
    detail:
      "Point to the test or command that checks the path. Say what it covers and what still needs runtime or user evidence.",
  },
  {
    label: "Reflect",
    title: "Name the next change.",
    prompt: "Limit, effect, smallest next step",
    detail:
      "Choose one limitation that matters. Explain who feels it and the smallest change you would verify with more time.",
  },
] as const;

export const takeHomeEvidenceLayers = [
  {
    label: "The repository shows",
    items: ["Entry points and boundaries", "Dependencies and configuration", "Tests and supported commands"],
  },
  {
    label: "You explain",
    items: ["The brief and time constraint", "Your rationale and rejected alternative", "The outcome and intended next step"],
  },
] as const;

export const takeHomeAnswerFrames = [
  {
    label: "Why this approach?",
    example: "The time limit made this boundary the smallest complete path.",
    use: "Connect the constraint to the choice, then point to the files that implement it.",
  },
  {
    label: "How did you verify it?",
    example: "This test protects the main path, but it does not prove production behavior.",
    use: "Name the check, what it covers, and the evidence you still need.",
  },
  {
    label: "What would you change?",
    example: "I would address this limit next because it affects the core path.",
    use: "Choose one material limit and describe the smallest defensible next step.",
  },
] as const;
