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
      ...(brief.interview_questions ?? []).flatMap((question) => question.evidence_refs),
    ];
    for (const id of referenced) {
      expect(knownIds.has(id)).toBe(true);
    }
    for (const question of brief.interview_questions ?? []) {
      if (!question.generic) {
        expect(question.evidence_refs.length).toBeGreaterThan(0);
      }
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
      "86ab059057ddc26c9a190f5757dcccce4d84074e244b0afec01d00aaa355a178",
    ],
    [
      "TypeScript",
      "repo-node-api",
      "d2577cfa2ffb6e47206331c6bc0942bc4038bdd8cc86ffbb819b2b59b6e191a5",
    ],
    [
      "Python",
      "repo-python",
      "2ab9ef2a975c2c5a8896f442ae59e573f9e9bd07120313384ebf19f99a92fa40",
    ],
    [
      "Java",
      "repo-java-maven",
      "fc374270ab8529bfdd17db4ef64796ab8358dc0df38eb613ab7642483f1327f6",
    ],
    [
      "monorepo",
      "repo-monorepo",
      "df98e00f7330fd10e043e64df1cfd11aa1b473145dfd4d86010421aabd88d324",
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
