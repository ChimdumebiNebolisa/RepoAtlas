import { CLIENT_MAX_ZIP_MB_VERCEL } from "@/lib/ingestLimitsClient";
import { REPORT_CAPABILITY_RULES } from "@/lib/reportCapabilities";

const dependableExportFormats = REPORT_CAPABILITY_RULES.alwaysAvailableExports.join(" and ");

export const homepageMetadata = {
  title: "Repository Context Briefs for Unfamiliar Codebases | RepoAtlas",
  description: `Turn a TypeScript, JavaScript, Python, or Java repository into an evidence-linked brief for interviews, code review, first contributions, and change planning, with ${dependableExportFormats} exports and no code execution.`,
} as const;

export const siteIdentity = {
  name: "RepoAtlas",
  description:
    "Generate evidence-backed repository context briefs from a public GitHub URL or ZIP. No code execution required.",
  url: "https://repo-atlas-phi.vercel.app/",
} as const;

export const homepageFaqItems = [
  {
    question: "What happens to an uploaded repository?",
    answer:
      "ZIP files are written to temporary server storage only for analysis and deleted when the request finishes. Generated report data may be stored so report, export, and sharing features can work; sharing is opt-in.",
  },
  {
    question: "Which repository types are supported?",
    answer:
      "RepoAtlas performs deeper static analysis for TypeScript and JavaScript, Python, and Java repositories. It also maps mixed-language monorepos, docs-only repositories, and repositories without a README, with confidence gaps shown when evidence is limited.",
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
] as const;
