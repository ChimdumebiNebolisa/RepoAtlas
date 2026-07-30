export const candidateBriefWalkthroughOutputs = [
  {
    title: "Repository purpose",
    description:
      "A plain-language account of what the repository appears to do, with confidence and source evidence.",
  },
  {
    title: "Important folders and files",
    description: "A folder map and prioritized reading path showing where to start.",
  },
  {
    title: "Architecture and dependencies",
    description: "Detected connections between supported files, modules, and dependencies.",
  },
  {
    title: "Evidence and next questions",
    description:
      "Key conclusions linked to files, plus suggested follow-up questions and inspection points.",
  },
] as const;

export const candidateBriefLanguageCoverage = "TypeScript/JavaScript, Python, and Java";
