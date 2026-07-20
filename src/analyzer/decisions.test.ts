import fs from "fs";
import os from "os";
import path from "path";
import { describe, expect, it } from "vitest";
import { detectTechnicalDecisions } from "./decisions";

function withRepo(files: Record<string, string>, run: (repoPath: string) => void) {
  const repoPath = fs.mkdtempSync(path.join(os.tmpdir(), "repoatlas-decisions-"));
  try {
    for (const [relativePath, content] of Object.entries(files)) {
      const filePath = path.join(repoPath, relativePath);
      fs.mkdirSync(path.dirname(filePath), { recursive: true });
      fs.writeFileSync(filePath, content);
    }
    run(repoPath);
  } finally {
    fs.rmSync(repoPath, { recursive: true, force: true });
  }
}

function packageJson(dependencies: Record<string, string>) {
  return JSON.stringify({ dependencies });
}

describe("detectTechnicalDecisions", () => {
  it.each([
    ["Next.js", { next: "16.0.0" }],
    ["React", { react: "19.0.0" }],
    ["Tailwind CSS", { tailwindcss: "3.0.0" }],
    ["Vitest", { vitest: "3.0.0" }],
    ["Jest", { jest: "29.0.0" }],
    ["Prisma", { prisma: "6.0.0" }],
    ["NextAuth / Auth.js", { "@auth/core": "0.30.0" }],
    ["Vercel Blob storage", { "@vercel/blob": "2.0.0" }],
  ])("links the %s package decision to package.json", (expectedDecision, dependencies) => {
    withRepo({ "package.json": packageJson(dependencies) }, (repoPath) => {
      const result = detectTechnicalDecisions(repoPath);
      const decision = result.decisions.find((item) => item.decision === expectedDecision);
      const evidence = result.evidence.find((ref) => ref.id === decision?.evidence_refs[0]);

      expect(decision?.evidence_refs).toHaveLength(1);
      expect(evidence).toMatchObject({ kind: "decision", path: "package.json" });
    });
  });

  it.each([
    ["Django", { "pyproject.toml": 'dependencies = ["django>=5.0"]' }, "pyproject.toml"],
    ["Tailwind CSS", { "tailwind.config.ts": "export default {}" }, "tailwind.config.ts"],
    ["Vercel", { "vercel.json": "{}" }, "vercel.json"],
    ["Docker", { Dockerfile: "FROM node:20" }, "Dockerfile"],
    ["pytest", { "pytest.ini": "[pytest]" }, "pytest.ini"],
  ])("links the %s config decision to its exact file", (expectedDecision, files, expectedPath) => {
    withRepo(files, (repoPath) => {
      const result = detectTechnicalDecisions(repoPath);
      const decision = result.decisions.find((item) => item.decision === expectedDecision);
      const evidence = result.evidence.find((ref) => ref.id === decision?.evidence_refs[0]);

      expect(decision?.evidence_refs).toHaveLength(1);
      expect(evidence).toMatchObject({ kind: "decision", path: expectedPath });
    });
  });

  it("deduplicates evidence when several decisions come from one manifest", () => {
    withRepo(
      {
        "package.json": packageJson({
          next: "16.0.0",
          tailwindcss: "3.0.0",
          vitest: "3.0.0",
          prisma: "6.0.0",
          "@auth/core": "0.30.0",
          "@vercel/blob": "2.0.0",
        }),
      },
      (repoPath) => {
        const result = detectTechnicalDecisions(repoPath);
        expect(result.decisions).toHaveLength(6);
        expect(result.evidence).toHaveLength(1);
        expect(new Set(result.decisions.flatMap((decision) => decision.evidence_refs))).toEqual(
          new Set(["decision-1"])
        );
      }
    );
  });

  it("does not emit unsupported choices from unrelated manifests", () => {
    withRepo(
      {
        "package.json": packageJson({ express: "4.0.0" }),
        "pyproject.toml": 'dependencies = ["fastapi>=0.100"]',
        "pom.xml": "<project><artifactId>plain-java</artifactId></project>",
      },
      (repoPath) => {
        expect(detectTechnicalDecisions(repoPath)).toEqual({ decisions: [], evidence: [] });
      }
    );
  });
});
