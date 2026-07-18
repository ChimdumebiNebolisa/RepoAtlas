import type { Metadata } from "next";
import { InfoPage } from "@/components/InfoPage";

export const metadata: Metadata = {
  title: "Privacy | RepoAtlas",
  description: "How RepoAtlas handles repository inputs, generated reports, and share links.",
};

const sections = [
  {
    title: "Repository inputs",
    items: [
      "Uploaded ZIP files are written to temporary server storage for analysis and deleted when the request finishes.",
      "Public GitHub URLs are used to retrieve public repository metadata and an archive for analysis.",
      "Repository files are read as text. RepoAtlas does not execute repository code or send it to an AI service.",
    ],
  },
  {
    title: "Generated reports and sharing",
    items: [
      "Generated report data may be stored so report, export, and sharing features can work.",
      "Sharing is opt-in. Anyone with an active share link can view the report associated with that link.",
      "Share responses contain report data, not the uploaded ZIP file.",
    ],
  },
  {
    title: "Questions",
    paragraphs: [
      "For a privacy question about RepoAtlas, email repo-atlas-phi@mail.tin.computer.",
    ],
  },
];

export default function PrivacyPage() {
  return (
    <InfoPage
      eyebrow="Repository privacy"
      title="Privacy"
      introduction="RepoAtlas processes repository content only to produce the analysis and report features you request."
      sections={sections}
    />
  );
}
