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
  title: "Source-linked Repository Briefs | RepoAtlas",
  description: `Analyze a public GitHub repository or ZIP without running code. Get a source-linked TypeScript/JavaScript, Python, or Java brief with ${dependableExportFormats} exports.`,
} as const;

export const siteIdentity = {
  name: "RepoAtlas",
  description:
    "Create source-linked repository briefs from public GitHub repositories or ZIP uploads without running code.",
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
      "The bundled sample is a complete read-only repository brief, called a Candidate Brief in RepoAtlas. It includes repository purpose, important folders and files, architecture and dependency connections, key conclusions linked to files, and suggested questions or inspection points. You can also preview PDF and PNG exports without uploading a repository.",
  },
  {
    question: "When should I use RepoAtlas?",
    answer:
      "Use RepoAtlas before an interview, while onboarding to an unfamiliar codebase, at the start of a bug investigation, or before a code or design discussion. It turns an initial repository scan into a reading order, source-linked talking points, and follow-up questions. Compare structured and ad hoc preparation.",
    link: {
      label: "Compare structured and ad hoc preparation.",
      href: "/codebase-interview-preparation",
    },
  },
  {
    question: "How is RepoAtlas different from asking an AI to summarize a repository?",
    answer:
      "General-purpose AI summaries can provide quick orientation, but the available context, file citations, and data handling vary by product. RepoAtlas does not send the repository to an AI service. It uses deterministic static analysis, links key conclusions to files you can inspect, and records confidence gaps when evidence is limited. Compare AI summaries and evidence-linked briefs.",
    link: {
      label: "Compare AI summaries and evidence-linked briefs.",
      href: "/ai-codebase-summary",
    },
  },
  {
    question: "What can RepoAtlas not infer from repository files?",
    answer:
      "RepoAtlas does not claim to understand every line or infer facts the files do not support. It cannot confirm bugs or vulnerabilities, prove correctness, determine production behavior or readiness, or know why a maintainer chose an approach. Repository purpose comes from README or project metadata and includes a confidence level.",
  },
];

export const homepageTrustBoundaries = [
  "RepoAtlas reads repository files as text; it never runs the code or sends it to an AI service.",
  "TypeScript/JavaScript gets AST-backed analysis. Python and Java get narrower structured analysis.",
  "Suggested inspection points are structural signals, not confirmed bugs or vulnerabilities.",
  "PDF and PNG remain available when saved report storage is unavailable.",
] as const;

export const homepageSupportedWorkflows = [
  {
    title: "Preparing for an interview",
    description:
      "Go from a repository you barely know to a reading order, source-linked talking points, and follow-up questions.",
  },
  {
    title: "Joining an unfamiliar codebase",
    description:
      "Go from scattered files and docs to the repository purpose, entry points, important folders, and connections.",
  },
  {
    title: "Investigating a bug",
    description:
      "Go from “where do I start?” to likely relevant files, dependencies, and structural hotspots to inspect next.",
  },
  {
    title: "Preparing for a code or design discussion",
    description:
      "Go from a proposed change to the files, boundaries, and dependencies you should understand before the conversation.",
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
