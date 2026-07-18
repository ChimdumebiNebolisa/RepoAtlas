import type { Metadata } from "next";
import { InfoPage } from "@/components/InfoPage";

export const metadata: Metadata = {
  title: "Terms | RepoAtlas",
  description: "Plain-language terms for using RepoAtlas repository analysis.",
};

const sections = [
  {
    title: "Using RepoAtlas",
    items: [
      "Submit only repository content that you are authorized to analyze.",
      "Do not use the service unlawfully, interfere with its operation, or attempt to bypass its limits.",
      "RepoAtlas accepts uploaded ZIP files and public GitHub repositories; it does not provide access to private repositories.",
    ],
  },
  {
    title: "Understanding the output",
    items: [
      "RepoAtlas produces deterministic analysis from the repository evidence it can inspect.",
      "Outputs are analysis aids, not security audits, vulnerability findings, or claims that a repository is production-ready.",
      "Review the linked evidence and confidence notes before relying on a generated Candidate Brief.",
    ],
  },
  {
    title: "Questions",
    paragraphs: [
      "For a question about these terms, email repo-atlas-phi@mail.tin.computer.",
    ],
  },
];

export default function TermsPage() {
  return (
    <InfoPage
      eyebrow="Service terms"
      title="Terms of use"
      introduction="These terms describe the boundaries for using RepoAtlas and interpreting its repository analysis."
      sections={sections}
    />
  );
}
