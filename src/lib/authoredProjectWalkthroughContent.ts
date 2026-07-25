export const authoredProjectWalkthroughMetadata = {
  title: "How to Walk Through a Project in an Interview | RepoAtlas",
  description:
    "Use a practical project interview structure for your contribution, architecture, technical decisions, tradeoffs, results, and next improvement.",
  openGraphDescription:
    "A practical method for explaining a personal project or take-home assignment with clear authorship and file-backed technical evidence.",
} as const;

export const authoredProjectAnswerSequence = [
  {
    label: "Frame",
    title: "Name the problem and the constraint",
    prompt: "What needed to change, for whom, and within what limit?",
    detail:
      "Give enough context to make the technical choices understandable. Keep the opening to one problem, one user or stakeholder, and the constraint that shaped the work.",
  },
  {
    label: "Own",
    title: "Draw the boundary around your contribution",
    prompt: "Which parts did you decide, build, test, or revise?",
    detail:
      "Separate your work from team decisions, starter code, libraries, and existing systems. Precise ownership is more credible than claiming the whole project.",
  },
  {
    label: "Trace",
    title: "Follow one useful system path",
    prompt: "Where does input enter, change, and leave the system?",
    detail:
      "Choose one request, command, or event that reaches the project's purpose. Use it to explain the architecture without touring every folder.",
  },
  {
    label: "Defend",
    title: "Explain one hard choice",
    prompt: "What options did you consider, and what constraint made one fit?",
    detail:
      "State your rationale from memory, then point to the interface, dependency, configuration, or test that shows how the choice appears in the code.",
  },
  {
    label: "Reflect",
    title: "Close with the result and next change",
    prompt: "What happened, what remains uncertain, and what would you improve?",
    detail:
      "Use an outcome you can support. If you do not have a production metric, describe the verified behavior, test result, or limitation instead of inventing impact.",
  },
] as const;

export const authoredProjectEvidenceLayers = [
  {
    label: "Only you can supply",
    items: ["The original problem", "Your contribution", "Why you chose an approach", "Constraints and outcomes"],
  },
  {
    label: "The repository can support",
    items: ["Entry points and system paths", "Module and dependency boundaries", "Tests and contribution commands", "Files behind technical claims"],
  },
] as const;

export const authoredProjectFollowUps = [
  {
    question: "Why did you choose this architecture?",
    answer:
      "Name the constraint first, compare the closest alternative, then show where the selected boundary appears in the code.",
  },
  {
    question: "What was the hardest part?",
    answer:
      "Describe the obstacle, the evidence that changed your understanding, and the smallest test or check that proved the resolution.",
  },
  {
    question: "What would you improve next?",
    answer:
      "Choose one limitation you can point to. Explain the user or maintenance effect, then name the first safe change and how you would verify it.",
  },
] as const;
