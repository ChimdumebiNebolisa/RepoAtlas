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
    const dangerZone = report.danger_zones[0]!;
    dangerZone.path = questionEvidence.path!;
    dangerZone.score = 79;
    dangerZone.metrics.complexity = 9;
    dangerZone.metrics.fan_out = 2;

    expect(buildHomepageSamplePreview(report)).toMatchObject({
      repositoryName: "fixture-derived-name",
      summary: "Fixture-derived plain-English summary.",
      walkthrough: "Fixture-derived 30-second walkthrough.",
      readingStep: {
        path: "src/fixture-entry.ts",
        why: "Fixture-derived reading reason.",
        evidence: { id: readingEvidence.id },
      },
      comparisonProof: {
        readingSequence: ["src/fixture-entry.ts", expect.any(String), expect.any(String)],
        dangerZone: {
          path: questionEvidence.path,
          score: 79,
          complexity: 9,
          fanOut: 2,
        },
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
        "This sample does not contain enough supported dependency evidence to describe a system connection.",
      evidence: null,
    });
  });

  it("prefers walkthrough architecture evidence before the report fallback", () => {
    const report = buildSampleReport();
    const brief = report.candidate_brief!;
    const fallbackArchitecture = brief.evidence_refs.find(
      (evidence) => evidence.kind === "architecture"
    )!;
    const walkthroughArchitecture = {
      ...fallbackArchitecture,
      id: "walkthrough-architecture",
      detail: "Architecture evidence cited by the walkthrough.",
    };

    fallbackArchitecture.detail = "Report-level architecture fallback.";
    brief.evidence_refs.push(walkthroughArchitecture);
    brief.walkthrough_script!.evidence_refs = [
      "missing-architecture-reference",
      walkthroughArchitecture.id,
    ];

    expect(buildHomepageSamplePreview(report)?.architecture).toEqual({
      explanation: "Architecture evidence cited by the walkthrough.",
      evidence: walkthroughArchitecture,
    });
  });

  it("falls back to report architecture evidence when walkthrough references do not resolve", () => {
    const report = buildSampleReport();
    const brief = report.candidate_brief!;
    const fallbackArchitecture = brief.evidence_refs.find(
      (evidence) => evidence.kind === "architecture"
    )!;

    fallbackArchitecture.detail = "Report-level architecture fallback.";
    brief.walkthrough_script!.evidence_refs = ["missing-architecture-reference"];

    expect(buildHomepageSamplePreview(report)?.architecture).toEqual({
      explanation: "Report-level architecture fallback.",
      evidence: fallbackArchitecture,
    });
  });

  it("uses the first complete reading step with resolvable evidence", () => {
    const report = buildSampleReport();
    const brief = report.candidate_brief!;
    const resolvedEvidence = brief.evidence_refs.find(
      (evidence) => evidence.kind === "start_here"
    )!;
    const fallbackStep = {
      ...brief.reading_path[0],
      order: 2,
      path: "src/resolved-entry.ts",
      why: "This step has repository evidence.",
      evidence_refs: ["missing-reading-reference", resolvedEvidence.id],
    };

    brief.reading_path = [
      {
        ...brief.reading_path[0],
        path: "src/unsupported-entry.ts",
        why: "This claim has no resolvable evidence.",
        evidence_refs: ["missing-reading-reference"],
      },
      fallbackStep,
    ];

    expect(buildHomepageSamplePreview(report)?.readingStep).toEqual({
      path: fallbackStep.path,
      why: fallbackStep.why,
      evidence: resolvedEvidence,
    });
  });

  it("withholds comparison proof when its reading sequence or Danger Zone is incomplete", () => {
    const shortSequence = buildSampleReport();
    shortSequence.candidate_brief!.reading_path =
      shortSequence.candidate_brief!.reading_path.slice(0, 2);
    expect(buildHomepageSamplePreview(shortSequence)?.comparisonProof).toBeNull();

    const missingRiskEvidence = buildSampleReport();
    missingRiskEvidence.candidate_brief!.evidence_refs =
      missingRiskEvidence.candidate_brief!.evidence_refs.filter(
        (evidence) => evidence.kind !== "danger_zone"
      );
    expect(buildHomepageSamplePreview(missingRiskEvidence)?.comparisonProof).toBeNull();

    const missingRiskMetric = buildSampleReport();
    missingRiskMetric.danger_zones.forEach((item) => {
      item.metrics.complexity = undefined;
    });
    expect(buildHomepageSamplePreview(missingRiskMetric)?.comparisonProof).toBeNull();
  });

  it("prefers an evidence-backed question over generic and broken specific prompts", () => {
    const report = buildSampleReport();
    const brief = report.candidate_brief!;
    const questionEvidence = brief.evidence_refs.find(
      (evidence) => evidence.kind === "danger_zone"
    )!;

    brief.interview_questions = [
      {
        question: "Unsupported repository-specific question?",
        rationale: "Its reference is broken.",
        evidence_refs: ["missing-question-reference"],
      },
      {
        question: "Generic static-analysis question?",
        rationale: "This prompt is intentionally evidence-free.",
        evidence_refs: [],
        generic: true,
      },
      {
        question: "Evidence-backed repository question?",
        rationale: "Its reference resolves.",
        evidence_refs: ["another-missing-reference", questionEvidence.id],
      },
    ];

    expect(buildHomepageSamplePreview(report)?.interviewerQuestion).toEqual({
      question: "Evidence-backed repository question?",
      rationale: "Its reference resolves.",
      evidence: questionEvidence,
    });
  });

  it("uses an explicitly generic question when no repository-specific prompt has evidence", () => {
    const report = buildSampleReport();
    const brief = report.candidate_brief!;

    brief.interview_questions = [
      {
        question: "Unsupported repository-specific question?",
        rationale: "Its reference is broken.",
        evidence_refs: ["missing-question-reference"],
      },
      {
        question: "Generic static-analysis question?",
        rationale: "This prompt is intentionally evidence-free.",
        evidence_refs: ["irrelevant-reference"],
        generic: true,
      },
    ];

    expect(buildHomepageSamplePreview(report)?.interviewerQuestion).toEqual({
      question: "Generic static-analysis question?",
      rationale: "This prompt is intentionally evidence-free.",
      evidence: null,
    });
  });

  it("does not invent a preview when required Candidate Brief structures are missing", () => {
    const report = buildSampleReport();
    report.candidate_brief = undefined;

    expect(buildHomepageSamplePreview(report)).toBeNull();

    const missingWalkthrough = buildSampleReport();
    missingWalkthrough.candidate_brief!.walkthrough_script = undefined;
    expect(buildHomepageSamplePreview(missingWalkthrough)).toBeNull();

    const missingReadingPath = buildSampleReport();
    missingReadingPath.candidate_brief!.reading_path = [];
    expect(buildHomepageSamplePreview(missingReadingPath)).toBeNull();
  });

  it("rejects incomplete walkthroughs, reading steps, and unsupported questions", () => {
    const missingWalkthroughText = buildSampleReport();
    missingWalkthroughText.candidate_brief!.walkthrough_script!.thirty_second = "   ";
    expect(buildHomepageSamplePreview(missingWalkthroughText)).toBeNull();

    const missingSummaryText = buildSampleReport();
    missingSummaryText.candidate_brief!.repo_summary.plain_english = "";
    expect(buildHomepageSamplePreview(missingSummaryText)).toBeNull();

    const incompleteReadingStep = buildSampleReport();
    incompleteReadingStep.candidate_brief!.reading_path = [
      {
        ...incompleteReadingStep.candidate_brief!.reading_path[0],
        path: "",
      },
    ];
    expect(buildHomepageSamplePreview(incompleteReadingStep)).toBeNull();

    const incompleteReadingReason = buildSampleReport();
    incompleteReadingReason.candidate_brief!.reading_path = [
      {
        ...incompleteReadingReason.candidate_brief!.reading_path[0],
        why: " ",
      },
    ];
    expect(buildHomepageSamplePreview(incompleteReadingReason)).toBeNull();

    const unsupportedQuestion = buildSampleReport();
    unsupportedQuestion.candidate_brief!.interview_questions = [
      {
        question: "Unsupported repository-specific question?",
        rationale: "Its reference is broken.",
        evidence_refs: ["missing-question-reference"],
      },
    ];
    expect(buildHomepageSamplePreview(unsupportedQuestion)).toBeNull();

    const missingQuestions = buildSampleReport();
    missingQuestions.candidate_brief!.interview_questions = undefined;
    expect(buildHomepageSamplePreview(missingQuestions)).toBeNull();
  });

  it("rejects incomplete generic questions and accepts a sparse evidence-backed preview", () => {
    const incompleteGeneric = buildSampleReport();
    incompleteGeneric.candidate_brief!.interview_questions = [
      {
        question: " ",
        rationale: "No usable question.",
        evidence_refs: [],
        generic: true,
      },
    ];
    expect(buildHomepageSamplePreview(incompleteGeneric)).toBeNull();

    const sparse = buildSampleReport();
    const brief = sparse.candidate_brief!;
    brief.evidence_refs = brief.evidence_refs.filter(
      (evidence) => evidence.kind !== "architecture"
    );
    brief.interview_questions = [
      {
        question: "What can static analysis not prove?",
        rationale: "Use this prompt to explain the evidence boundary.",
        evidence_refs: [],
        generic: true,
      },
    ];

    expect(buildHomepageSamplePreview(sparse)).toMatchObject({
      architecture: {
        evidence: null,
      },
      interviewerQuestion: {
        question: "What can static analysis not prove?",
        evidence: null,
      },
    });
  });
});
