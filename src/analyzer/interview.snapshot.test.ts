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
      [
        "86ab059057ddc26c9a190f5757dcccce4d84074e244b0afec01d00aaa355a178",
        "9e13435095dbb3c54e63a156cce7ee88153e0d6dc20139fa508a5220ffee835d",
      ],
    ],
    [
      "TypeScript",
      "repo-node-api",
      [
        "d2577cfa2ffb6e47206331c6bc0942bc4038bdd8cc86ffbb819b2b59b6e191a5",
        "9f9f35aa1963746fee744c6e3bc9b07e5a6e2139071deac4e3641d0248a3e31f",
        "f8f59df0b38d7a5ed599859d73da4b7efc8404f502a4ea4e1119e47ff274065d",
        "9c0e49742a7493839997a59d4d6e920790df4908ce896dead0ed0329e81786bc",
      ],
    ],
    [
      "Python",
      "repo-python",
      [
        "2ab9ef2a975c2c5a8896f442ae59e573f9e9bd07120313384ebf19f99a92fa40",
        "056846ba4dc67b9fec3901019466e7abdf70ad37b3a30b31c6ef7b4cb4af28a4",
        "2d4dd5b0674ebed7f11820a6d51184d22a7b09d5e8b062dc9a4ef700fb71ae89",
        "1a6167611327e1c269feaddc645c1be40eb0b4b063fede78ebb5404610a93203",
        "2f1ac9bea7158b299c682ca8932532f5577c64cfe3366860e65901bc6c3c3fcb",
        "f3cafa812436048f0e2ba53dc824eb7d5d0aaef69e75c2bb8e29335efac718ea",
      ],
    ],
    [
      "Java",
      "repo-java-maven",
      [
        "fc374270ab8529bfdd17db4ef64796ab8358dc0df38eb613ab7642483f1327f6",
        "e3c33c40fdf9bb708ff60691fc826224db5ea36fe60365f0a3ec72aaea90d584",
        "856d5ad943c2235c0796d297eb7df0be500dd6c0603842ec0a5beffa107d4ff7",
        "47c6b4119f4c4789eb27676501bc7c4e4013ec5187d9dee5c6843fac65f9b455",
      ],
    ],
    [
      "monorepo",
      "repo-monorepo",
      [
        "df98e00f7330fd10e043e64df1cfd11aa1b473145dfd4d86010421aabd88d324",
        "b2873d77a966d105fa69d47b568361f336cf90e75448177d973fe801824b30ca",
        "0f9e593845ac86b28909d29425f7a7175c483aa6d03f2b6af2a38d2f8067fb27",
        "3e16cc89cdf6bf58bbd1b66a0fbbdf7387caf75071298bdeba14dc2216416a59",
      ],
    ],
  ])("preserves the %s fixture byte-for-byte", async (_label, fixture, expectedDigests) => {
    const fixturePath = path.resolve(__dirname, `../../fixtures/${fixture}`);
    const { report } = await analyzeRepository({ zipRef: fixturePath });
    // Git can materialize text fixtures with LF or CRLF. Keep an exact golden
    // for each checkout representation rather than weakening object coverage.
    const serialized = JSON.stringify(report.candidate_brief);
    const digest = createHash("sha256").update(serialized).digest("hex");
    expect(expectedDigests).toContain(digest);
  }, 30000);
});
