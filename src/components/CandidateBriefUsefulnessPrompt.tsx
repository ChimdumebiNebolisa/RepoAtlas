"use client";

import { useId, useMemo, useState } from "react";

const SUPPORT_EMAIL = "repo-atlas-phi@mail.tin.computer";
const SUBJECT = "RepoAtlas Candidate Brief feedback";

export const candidateBriefUsefulnessSections = [
  "Repo Summary",
  "Walkthrough Script",
  "Reading Path",
  "System Flow",
  "Interview Talking Points",
  "Interview Questions",
  "First PR Plan",
  "Evidence",
] as const;

type CandidateBriefUsefulnessSection =
  (typeof candidateBriefUsefulnessSections)[number];

export function buildCandidateBriefUsefulnessMailto(
  section: CandidateBriefUsefulnessSection,
  comment: string
) {
  const trimmedComment = comment.trim();
  const lines = [
    "Which section would you use in an interview or code discussion?",
    "",
    `Section: ${section}`,
  ];

  if (trimmedComment) lines.push(`Comment: ${trimmedComment}`);

  return `mailto:${SUPPORT_EMAIL}?${new URLSearchParams({
    subject: SUBJECT,
    body: lines.join("\n"),
  }).toString()}`;
}

export function CandidateBriefUsefulnessPrompt() {
  const promptId = useId();
  const [section, setSection] = useState<CandidateBriefUsefulnessSection | "">("");
  const [comment, setComment] = useState("");
  const mailto = useMemo(
    () => (section ? buildCandidateBriefUsefulnessMailto(section, comment) : undefined),
    [comment, section]
  );

  return (
    <aside className="report-usefulness-prompt" aria-labelledby={`${promptId}-heading`}>
      <div className="report-usefulness-intro">
        <p className="report-usefulness-eyebrow">Optional feedback</p>
        <h2 id={`${promptId}-heading`}>
          Which section would you use in an interview or code discussion?
        </h2>
        <p>
          Your answer opens a prefilled message to RepoAtlas support. Send it only if you want
          to.
        </p>
      </div>

      <div className="report-usefulness-fields">
        <label htmlFor={`${promptId}-section`}>Section</label>
        <select
          id={`${promptId}-section`}
          value={section}
          onChange={(event) =>
            setSection(event.target.value as CandidateBriefUsefulnessSection | "")
          }
        >
          <option value="">Choose a section</option>
          {candidateBriefUsefulnessSections.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>

        <label htmlFor={`${promptId}-comment`}>Optional comment</label>
        <textarea
          id={`${promptId}-comment`}
          value={comment}
          maxLength={500}
          rows={3}
          onChange={(event) => setComment(event.target.value)}
          placeholder="What would make this section more useful?"
        />

        <p id={`${promptId}-privacy`} className="report-usefulness-privacy">
          RepoAtlas adds only your section choice and comment to the draft. Do not include
          repository names, links, or source content.
        </p>

        {mailto ? (
          <a
            href={mailto}
            aria-describedby={`${promptId}-privacy`}
            className="report-action report-action-secondary report-usefulness-action"
          >
            Open feedback message
          </a>
        ) : (
          <button
            type="button"
            disabled
            aria-describedby={`${promptId}-privacy`}
            className="report-action report-action-secondary report-usefulness-action"
          >
            Open feedback message
          </button>
        )}
      </div>
    </aside>
  );
}
