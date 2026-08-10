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

export const siteIdentity = {
  name: "RepoAtlas",
  description:
    "Create source-linked repository briefs from public GitHub repositories or ZIP uploads without running code.",
  url: "https://repo-atlas-phi.vercel.app/",
} as const;

export const homepageMetadata = {
  title: "Source-linked Repository Briefs | RepoAtlas",
  description: `Analyze a public GitHub repository or ZIP without running code. Get a source-linked TypeScript/JavaScript, Python, or Java brief with ${dependableExportFormats} exports.`,
  alternates: { canonical: siteIdentity.url },
  openGraph: {
    title: "Source-linked Repository Briefs | RepoAtlas",
    description: siteIdentity.description,
    type: "website",
    url: siteIdentity.url,
    siteName: siteIdentity.name,
  },
  twitter: {
    card: "summary",
    title: "Source-linked Repository Briefs | RepoAtlas",
    description: siteIdentity.description,
  },
} as const;

export const homepageFaqItems: readonly HomepageFaqItem[] = [
  {
    question: "What happens to an uploaded repository?",
    answer:
      "ZIP files are stored temporarily for analysis, then deleted. Report data may be saved for reports, exports, and optional sharing.",
  },
  {
    question: "Which repository types are supported?",
    answer:
      "Public TypeScript/JavaScript, Python, and Java repositories. TypeScript/JavaScript analysis is deeper; Python and Java analysis is narrower. Limited evidence appears as a confidence gap.",
  },
  {
    question: "How large can a ZIP upload be?",
    answer: `ZIP uploads are limited to ${CLIENT_MAX_ZIP_MB_VERCEL} MB on the hosted site. For a larger public repository, paste its public GitHub URL instead.`,
  },
  {
    question: "Does RepoAtlas run code from my repository?",
    answer:
      "No. RepoAtlas reads files as text. It does not execute code or send it to an AI service.",
  },
  {
    question: "What does the bundled sample include?",
    answer:
      "Purpose, key files, connections, file citations, confidence gaps, and follow-up questions. PDF and PNG previews require no upload.",
  },
  {
    question: "When should I use RepoAtlas?",
    answer:
      "Before an interview, onboarding, a bug investigation, or a code or design discussion. Get a reading order, cited talking points, and follow-up questions. Compare structured and ad hoc preparation.",
    link: {
      label: "Compare structured and ad hoc preparation.",
      href: "/codebase-interview-preparation",
    },
  },
  {
    question: "How is RepoAtlas different from asking an AI to summarize a repository?",
    answer:
      "AI summary capabilities vary. RepoAtlas uses deterministic static analysis, sends no code to an AI service, cites files, and shows confidence gaps. Compare AI summaries and evidence-linked briefs.",
    link: {
      label: "Compare AI summaries and evidence-linked briefs.",
      href: "/ai-codebase-summary",
    },
  },
  {
    question: "What can RepoAtlas not infer from repository files?",
    answer:
      "RepoAtlas does not understand every line or invent unsupported facts. It cannot confirm bugs, prove correctness, determine production behavior or readiness, or know maintainer intent.",
  },
];

export const homepageTrustBoundaries = [
  "Reads files as text. Never runs code or calls AI.",
  "Deeper TypeScript/JavaScript analysis; narrower Python and Java analysis.",
  "Inspection points are signals, not confirmed bugs or vulnerabilities.",
  "PDF and PNG work without saved report storage.",
] as const;

export const homepageSupportedWorkflows = [
  {
    title: "Preparing for an interview",
    description: "Go from a new repository to key files and cited talking points.",
  },
  {
    title: "Joining an unfamiliar codebase",
    description: "Go from scattered files to purpose, entry points, and connections.",
  },
  {
    title: "Investigating a bug",
    description: "Go from a symptom to likely files, dependencies, and inspection points.",
  },
  {
    title: "Preparing for a code or design discussion",
    description: "Go from a proposal to affected files, boundaries, and dependencies.",
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
