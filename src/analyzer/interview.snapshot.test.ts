import { describe, expect, it } from "vitest";
import path from "path";
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
    expect(brief.first_pr_plan).toHaveLength(3);
    expect(brief.evidence_refs.length).toBeGreaterThan(0);

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
  }, 30000);
});
