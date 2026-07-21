export const candidateBriefWalkthroughOutputs = [
  {
    title: "Entry points",
    description: "Likely files and commands that start the system.",
  },
  {
    title: "Architecture",
    description: "Boundaries and dependency paths across the codebase.",
  },
  {
    title: "Risk signals",
    description: "Structural hotspots to inspect, not assumed bugs.",
  },
  {
    title: "Reading order",
    description: "A ranked path from orientation to deeper review.",
  },
] as const;

export const candidateBriefLanguageCoverage = "TypeScript/JavaScript, Python, and Java";
