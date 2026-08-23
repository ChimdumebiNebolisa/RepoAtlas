export const candidateBriefWalkthroughOutputs = [
  {
    title: "Repository purpose",
    description: "What the repository appears to do, with confidence.",
  },
  {
    title: "Important folders and files",
    description: "A folder map and suggested reading order.",
  },
  {
    title: "Architecture and dependencies",
    description: "Supported connections between files, modules, and dependencies.",
  },
  {
    title: "Evidence and next questions",
    description: "File citations, confidence gaps, and follow-up questions.",
  },
] as const;

export const candidateBriefProofPromise =
  "Answer “Where would you start?” with a ranked reading path and talking points backed by source files.";

export const candidateBriefHomepagePromise =
  "Answer that question with a ranked reading path and talking points backed by source files.";

export const candidateBriefLanguageCoverage = "TypeScript/JavaScript, Python, and Java";
