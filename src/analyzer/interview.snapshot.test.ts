import { describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import path from "path";
import expectedBrief from "../../fixtures/repo-ts/expected-brief.json";
import { analyzeRepository } from "./index";

const DENYLIST = [
  "vulnerability",
  "vulnerabilities",
  "production ready",
  "has bugs",
  "business purpose",
];

describe("Candidate Brief snapshots (repo-ts)", () => {
  const fixturePath = path.resolve(__dirname, "../../fixtures/repo-ts");

  it("matches stable brief shape and evidence integrity", async () => {
    const { report } = await analyzeRepository({ zipRef: fixturePath });
    const brief = report.candidate_brief;
    expect(brief).toBeDefined();
    if (!brief) return;

    expect(brief.reading_path.length).toBeGreaterThan(0);
    expect(brief.first_pr_plan.length).toBeGreaterThan(0);
    expect(brief.first_pr_plan.length).toBeLessThanOrEqual(3);
    expect(brief.evidence_refs.length).toBeGreaterThan(0);
    expect(brief.interview_talking_points.tradeoffs.answer).toBeTruthy();

    const knownIds = new Set(brief.evidence_refs.map((ref) => ref.id));
    const referenced = [
      ...brief.repo_summary.primary_evidence,
      ...brief.reading_path.flatMap((item) => item.evidence_refs),
      ...Object.values(brief.interview_talking_points).flatMap((a) => a.evidence_refs),
      ...brief.first_pr_plan.flatMap((idea) => idea.evidence_refs),
      ...brief.resume_bullets.flatMap((b) => b.evidence_refs),
    ];
    for (const id of referenced) {
      expect(knownIds.has(id)).toBe(true);
    }

    const serialized = JSON.stringify(brief).toLowerCase();
    for (const phrase of DENYLIST) {
      expect(serialized).not.toContain(phrase);
    }

    expect(brief.repo_summary).toMatchObject({
      headline: expect.any(String),
      plain_english: expect.any(String),
      confidence: expect.stringMatching(/^(high|medium|low)$/),
    });

    expect(brief.repo_summary.headline).toBe(expectedBrief.repo_summary.headline);
    expect(brief.repo_summary.confidence).toBe(expectedBrief.repo_summary.confidence);
    expect(brief.reading_path.map((item) => ({
      order: item.order,
      title: item.title,
      path: item.path,
    }))).toEqual(expectedBrief.reading_path);
    expect(brief.first_pr_plan.map((idea) => idea.title)).toEqual(
      expectedBrief.first_pr_plan_titles
    );
    expect(brief.reading_path[0]?.path).toBe("src/app/api/health/route.ts");
  }, 30000);
});

describe("Candidate Brief byte stability", () => {
  it.each([
    [
      "bundled sample",
      "repo-ts",
      "91f72626fcf8c3ed8236c59201613efeb19867b922ebf99e3a8b48be7b763186",
    ],
    [
      "TypeScript",
      "repo-node-api",
      "a08e16ba95ec31c2305586b681a765c06f79dc67f802bf1120353833f011c750",
    ],
    [
      "Python",
      "repo-python",
      "0a1a840405e262ccaa577127c6a72b29cd9c23ba576dba417abd9ca980184b48",
    ],
    [
      "Java",
      "repo-java-maven",
      "1ab1e49d911d52ad045daa83bdba38deab6632f13823e4d44fa8b30c9af67140",
    ],
    [
      "monorepo",
      "repo-monorepo",
      "c7d953ca53c60cd9c464928d9f2c393c8b171a308494837072e56fb0d444b448",
    ],
  ])("preserves the %s fixture byte-for-byte", async (_label, fixture, expected) => {
    const fixturePath = path.resolve(__dirname, `../../fixtures/${fixture}`);
    const { report } = await analyzeRepository({ zipRef: fixturePath });
    // Candidate Briefs contain no timestamps, so the entire object is hashed
    // without normalization or excluded fields.
    const serialized = JSON.stringify(report.candidate_brief);
    const digest = createHash("sha256").update(serialized).digest("hex");
    expect(digest).toBe(expected);
  }, 30000);
});
