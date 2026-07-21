import { describe, expect, it } from "vitest";
import { buildSampleReport } from "@/lib/buildSampleReport";
import { buildHomepageSamplePreview } from "@/lib/homepageSamplePreview";

describe("buildHomepageSamplePreview", () => {
  it("derives every visible artifact from the report and resolves its evidence", () => {
    const report = buildSampleReport();
    const brief = report.candidate_brief!;
    const readingEvidence = brief.evidence_refs.find((evidence) => evidence.kind === "start_here")!;
    const architectureEvidence = brief.evidence_refs.find(
      (evidence) => evidence.kind === "architecture"
    )!;
    const questionEvidence = brief.evidence_refs.find(
      (evidence) => evidence.kind === "danger_zone"
    )!;

    report.repo_metadata.name = "fixture-derived-name";
    brief.repo_summary.plain_english = "Fixture-derived plain-English summary.";
    brief.walkthrough_script!.thirty_second = "Fixture-derived 30-second walkthrough.";
    brief.reading_path[0] = {
      ...brief.reading_path[0],
      path: "src/fixture-entry.ts",
      why: "Fixture-derived reading reason.",
      evidence_refs: [readingEvidence.id],
    };
    brief.walkthrough_script!.evidence_refs = [architectureEvidence.id];
    architectureEvidence.detail = "Fixture-derived architecture explanation.";
    brief.interview_questions = [
      {
        question: "Generic prompt without repository evidence?",
        rationale: "Generic prompt.",
        evidence_refs: [],
        generic: true,
      },
      {
        question: "Fixture-derived interviewer question?",
        rationale: "Fixture-derived question rationale.",
        evidence_refs: [questionEvidence.id],
      },
    ];

    expect(buildHomepageSamplePreview(report)).toMatchObject({
      repositoryName: "fixture-derived-name",
      summary: "Fixture-derived plain-English summary.",
      walkthrough: "Fixture-derived 30-second walkthrough.",
      readingStep: {
        path: "src/fixture-entry.ts",
        why: "Fixture-derived reading reason.",
        evidence: { id: readingEvidence.id },
      },
      architecture: {
        explanation: "Fixture-derived architecture explanation.",
        evidence: { id: architectureEvidence.id },
      },
      interviewerQuestion: {
        question: "Fixture-derived interviewer question?",
        rationale: "Fixture-derived question rationale.",
        evidence: { id: questionEvidence.id },
      },
    });
  });

  it("states the boundary when no architecture evidence is available", () => {
    const report = buildSampleReport();
    const brief = report.candidate_brief!;

    brief.evidence_refs = brief.evidence_refs.filter(
      (evidence) => evidence.kind !== "architecture"
    );

    expect(buildHomepageSamplePreview(report)?.architecture).toEqual({
      explanation:
        "This sample does not contain enough supported dependency evidence for a system-flow claim.",
      evidence: null,
    });
  });

  it("does not invent a preview when required Candidate Brief fields are missing", () => {
    const report = buildSampleReport();
    report.candidate_brief = undefined;

    expect(buildHomepageSamplePreview(report)).toBeNull();
  });
});
