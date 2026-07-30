import { CLIENT_MAX_ZIP_MB_VERCEL } from "@/lib/ingestLimitsClient";
import { REPORT_CAPABILITY_RULES } from "@/lib/reportCapabilities";

const dependableExportFormats = REPORT_CAPABILITY_RULES.alwaysAvailableExports.join(" and ");

export type HomepageFaqItem = {
  question: string;
  answer: string;
  link?: {
    label: string;
    href: string;
  };
};

export const homepageMetadata = {
  title: "Evidence-backed Repository Walkthroughs | RepoAtlas",
  description: `Turn a public TypeScript, JavaScript, Python, or Java repository into an evidence-backed walkthrough with ${dependableExportFormats} exports, without running code.`,
} as const;

export const siteIdentity = {
  name: "RepoAtlas",
  description:
    "Generate evidence-backed repository walkthroughs from public GitHub repositories or ZIP uploads.",
  url: "https://repo-atlas-phi.vercel.app/",
} as const;

export const homepageFaqItems: readonly HomepageFaqItem[] = [
  {
    question: "What happens to an uploaded repository?",
    answer:
      "ZIP files are written to temporary server storage only for analysis and deleted when the request finishes. Generated report data may be stored so report, export, and sharing features can work; sharing is opt-in.",
  },
  {
    question: "Which repository types are supported?",
    answer:
      "RepoAtlas supports public TypeScript and JavaScript, Python, and Java repositories. TypeScript and JavaScript receive stronger AST-backed analysis; Python and Java use more limited structured analysis. Mixed-language, docs-only, and no-README repositories still expose confidence gaps when evidence is limited.",
  },
  {
    question: "How large can a ZIP upload be?",
    answer: `ZIP uploads are limited to ${CLIENT_MAX_ZIP_MB_VERCEL} MB on the hosted site. For a larger public repository, paste its public GitHub URL instead.`,
  },
  {
    question: "Does RepoAtlas run code from my repository?",
    answer:
      "No. RepoAtlas reads repository files as text and uses deterministic static analysis. It does not execute uploaded code or send it to an AI service.",
  },
  {
    question: "What does the bundled sample include?",
    answer:
      "The bundled sample includes a complete read-only Candidate Brief with a repo summary, reading path, architecture map, risk signals, run commands, interview talking points, and evidence references. You can also preview PDF and PNG exports without uploading a repository.",
  },
  {
    question: "When does a structured repository walkthrough help?",
    answer:
      "Use a structured walkthrough when the repository is unfamiliar, the interview can move across the system, or the same evidence must support both a short and detailed answer. Compare structured and ad hoc preparation.",
    link: {
      label: "Compare structured and ad hoc preparation.",
      href: "/codebase-interview-preparation",
    },
  },
  {
    question: "How is a Candidate Brief different from an AI codebase summary?",
    answer:
      "An AI codebase summary can provide quick orientation. Its context, citations, and privacy boundary depend on the product. RepoAtlas uses deterministic static analysis to build a reading order, timed walkthroughs, and claims linked to files you can inspect. Compare AI summaries and evidence-linked briefs.",
    link: {
      label: "Compare AI summaries and evidence-linked briefs.",
      href: "/ai-codebase-summary",
    },
  },
  {
    question: "What can RepoAtlas not infer from repository files?",
    answer:
      "RepoAtlas cannot confirm bugs or vulnerabilities, prove correctness, infer business purpose, assess production readiness, or reliably infer dynamic runtime behavior. It also cannot prove authorship or why a maintainer chose an approach. Verify those claims outside the repository structure.",
  },
];

export const homepageTrustBoundaries = [
  "Reads files as text. It does not execute repository code or call AI.",
  "TypeScript/JavaScript receives stronger AST-backed analysis; Python and Java use more limited structured analysis.",
  "Risk signals identify structural hotspots, not confirmed bugs or vulnerabilities.",
  "PDF and PNG remain available when saved report storage is unavailable.",
] as const;

export const homepageSupportedWorkflows = [
  {
    title: "Interview walkthrough",
    description: "Explain an unfamiliar project clearly with evidence ready for follow-up questions.",
  },
  {
    title: "New-codebase orientation",
    description: "Find the reading path before changing code.",
  },
  {
    title: "Bug investigation",
    description: "Identify relevant structural areas before deeper debugging.",
  },
  {
    title: "Planned change or PR discussion",
    description: "Understand affected boundaries before proposing work.",
  },
] as const;

export const homepageInterviewGuides = [
  {
    title: "Explain an unfamiliar repository",
    description: "Use an evidence-first reading order for code you did not build.",
    href: "/repository-walkthrough-interview",
  },
  {
    title: "Explain a project you built",
    description:
      "Separate your decisions from the repository evidence that supports them.",
    href: "/how-to-walk-through-a-project-in-an-interview",
  },
] as const;
