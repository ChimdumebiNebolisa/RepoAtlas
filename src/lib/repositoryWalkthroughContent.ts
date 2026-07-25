export const repositoryWalkthroughMetadata = {
  title: "Repository Walkthrough Interview Guide | RepoAtlas",
  description:
    "Learn how to explain an unfamiliar repository with a defensible reading order, architecture map, risk signals, and file-backed talking points.",
  openGraphDescription:
    "A practical method for walking an interviewer through an unfamiliar repository without guessing beyond the code.",
} as const;

export const repositoryWalkthroughReadingOrder = [
  {
    title: "Orient from the repository contract",
    time: "Minute 0-2",
    files: "README, manifest, config",
    detail:
      "Start with the stated purpose, supported commands, dependencies, and environment shape. Treat documentation as a claim to verify against the files, not as proof of runtime behavior.",
  },
  {
    title: "Find the likely entry point",
    time: "Minute 2-4",
    files: "main, app, index, routes",
    detail:
      "Use scripts, framework conventions, and executable declarations to locate where control probably enters. Say likely until a file or command makes the entry explicit.",
  },
  {
    title: "Trace one representative path",
    time: "Minute 4-7",
    files: "entry to boundary to output",
    detail:
      "Follow one request, command, or event through the modules it touches. A narrow path is easier to defend than a tour of every folder.",
  },
  {
    title: "Check the safety net",
    time: "Minute 7-9",
    files: "tests, CI, contribution docs",
    detail:
      "Look for the tests nearest that path, the commands CI runs, and the guidance a contributor would follow. These files show how the repository expects changes to be checked.",
  },
  {
    title: "Mark what remains unknown",
    time: "Minute 9-10",
    files: "gaps, warnings, follow-ups",
    detail:
      "Separate what the files show from what you infer. Name the runtime or product questions you would ask rather than filling the gaps with a confident guess.",
  },
] as const;

export const repositoryWalkthroughArchitectureSignals = [
  {
    signal: "Entry",
    evidence: "Application bootstrap, route, CLI command, or executable declaration",
    question: "Where does control first enter?",
  },
  {
    signal: "Boundary",
    evidence: "Module imports, package edges, adapters, controllers, or service interfaces",
    question: "Where does responsibility change hands?",
  },
  {
    signal: "State",
    evidence: "Database clients, stores, caches, files, or external integrations",
    question: "Where does information persist or leave the system?",
  },
  {
    signal: "Proof",
    evidence: "Tests, CI workflows, manifests, and configuration",
    question: "Which files support this explanation?",
  },
] as const;

export const repositoryWalkthroughEvidenceLanguage = [
  {
    label: "Observed",
    example: "The package script starts src/index.ts.",
    use: "Use when a file directly supports the statement.",
  },
  {
    label: "Inferred",
    example: "This import path suggests the request crosses into the service layer.",
    use: "Use when structure supports a bounded interpretation.",
  },
  {
    label: "Unknown",
    example: "Static files do not show which branch receives production traffic.",
    use: "Use when the repository cannot prove the answer.",
  },
] as const;

