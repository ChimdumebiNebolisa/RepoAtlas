import { describe, expect, it } from "vitest";
import type { CandidateBrief } from "@/types/report";
import { buildEvidenceUsedByIndex, groupEvidenceByKind } from "./evidenceIndex";

function makeBrief(): CandidateBrief {
  return {
    analysis_focus: {
      intent: "bug",
      label: "Bug investigation",
      summary: "Trace the issue.",
      review_steps: [
        { title: "Trace entry", detail: "Start here", evidence_refs: ["focus"] },
      ],
      discussion_questions: ["What changed?"],
    },
    repo_summary: {
      headline: "Repo",
      plain_english: "A repository.",
      primary_evidence: ["summary"],
      confidence: "high",
    },
    reading_path: [
      { order: 1, title: "Read me", path: "README.md", why: "Start here", evidence_refs: ["readme"] },
    ],
    interview_talking_points: {
      walk_me_through_codebase: { answer: "Walk", bullets: [], evidence_refs: ["walk"], confidence: "high" },
      riskiest_areas: { answer: "Risk", bullets: [], evidence_refs: ["risk"], confidence: "medium" },
      improve_first: { answer: "Improve", bullets: [], evidence_refs: ["improve"], confidence: "medium" },
      first_week_contribution: { answer: "Week one", bullets: [], evidence_refs: ["week"], confidence: "low" },
    },
    first_pr_plan: [
      { title: "First change", rationale: "Evidence", suggested_files: [], evidence_refs: ["pr"], risk: "low" },
    ],
    resume_bullets: [
      { audience: "resume", text: "Resume", evidence_refs: ["resume", "summary"] },
      { audience: "linkedin", text: "LinkedIn", evidence_refs: ["linkedin"] },
    ],
    walkthrough_script: {
      thirty_second: "Short",
      two_minute: "Longer",
      deep_technical: "Deep",
      tradeoffs_to_mention: ["React"],
      improvements_next: [],
      evidence_refs: ["decision"],
    },
    behavioral_hooks: [
      {
        prompt: "Tradeoff (STAR template)",
        answer_starter: "Discuss React.",
        evidence_refs: ["decision"],
        sufficient_evidence: true,
      },
    ],
    evidence_refs: [],
    warnings: [],
  };
}

describe("evidence indexes", () => {
  it("maps every Candidate Brief section to its evidence IDs", () => {
    const index = buildEvidenceUsedByIndex(makeBrief());

    expect(index.get("summary")).toEqual(["Repo Summary", "Resume: resume"]);
    expect(index.get("focus")).toEqual(["Issue Focus: Trace entry"]);
    expect(index.get("readme")).toEqual(["Reading Path: README.md"]);
    expect(index.get("walk")).toEqual(["Walk me through"]);
    expect(index.get("risk")).toEqual(["Riskiest areas"]);
    expect(index.get("improve")).toEqual(["Improve first"]);
    expect(index.get("week")).toEqual(["First week"]);
    expect(index.get("pr")).toEqual(["First PR: First change"]);
    expect(index.get("linkedin")).toEqual(["Resume: linkedin"]);
    expect(index.get("decision")).toEqual([
      "Walkthrough Script",
      "Behavioral Hook: Tradeoff (STAR template)",
    ]);
  });

  it("groups evidence references by kind while preserving order", () => {
    const refs: CandidateBrief["evidence_refs"] = [
      { id: "a", kind: "file", label: "A" },
      { id: "b", kind: "doc", label: "B" },
      { id: "c", kind: "file", label: "C" },
    ];

    expect(groupEvidenceByKind(refs)).toEqual({
      file: [refs[0], refs[2]],
      doc: [refs[1]],
    });
  });
});
