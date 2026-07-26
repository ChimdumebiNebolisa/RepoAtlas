import fs from "fs";
import os from "os";
import path from "path";
import { describe, expect, it, vi } from "vitest";
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

  it.each([
    [
      "Django",
      {
        "pyproject.toml": [
          "[project]",
          "dependencies = [",
          '  "Django[argon2]>=5.0",',
          "]",
        ].join("\n"),
      },
      "pyproject.toml",
    ],
    [
      "pytest",
      {
        "pyproject.toml": [
          "[project.optional-dependencies]",
          'test = ["pytest>=8"]',
        ].join("\n"),
      },
      "pyproject.toml",
    ],
    [
      "pytest",
      {
        "pyproject.toml": [
          "[tool.poetry.group.test.dependencies]",
          'pytest = "^8.0"',
        ].join("\n"),
      },
      "pyproject.toml",
    ],
    ["Django", { "requirements.txt": "Django[argon2] >= 5 # supported extra" }, "requirements.txt"],
    ["pytest", { "requirements-dev.txt": "pytest~=8.0" }, "requirements-dev.txt"],
  ])(
    "recognizes the valid %s Python declaration and keeps its exact source",
    (expectedDecision, files, expectedPath) => {
      withRepo(files, (repoPath) => {
        const result = detectTechnicalDecisions(repoPath);
        const decision = result.decisions.find((item) => item.decision === expectedDecision);
        const evidence = result.evidence.find((ref) => ref.id === decision?.evidence_refs[0]);

        expect(decision?.evidence_refs).toHaveLength(1);
        expect(evidence).toMatchObject({ kind: "decision", path: expectedPath });
      });
    }
  );

  it("recognizes supported alternate config forms", () => {
    withRepo(
      {
        "tailwind.config.js": "module.exports = {}",
        Dockerfile: "FROM --platform=linux/amd64 node:20",
      },
      (repoPath) => {
        const result = detectTechnicalDecisions(repoPath);
        expect(result.decisions.map((decision) => decision.decision)).toEqual([
          "Tailwind CSS",
          "Docker",
        ]);
        expect(result.evidence.map((ref) => ref.path)).toEqual([
          "tailwind.config.js",
          "Dockerfile",
        ]);
      }
    );
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

  it("ignores dependency names found only in Python comments and examples", () => {
    withRepo(
      {
        "pyproject.toml": [
          "[project]",
          'name = "example"',
          'description = "A django example used in documentation"',
        ].join("\n"),
        "requirements.txt": "# pytest>=8 is shown here as an example",
      },
      (repoPath) => {
        expect(detectTechnicalDecisions(repoPath)).toEqual({ decisions: [], evidence: [] });
      }
    );
  });

  it("rejects malformed or content-free configuration evidence", () => {
    withRepo(
      {
        "package.json": "{ not-json",
        "pyproject.toml": 'dependencies = ["django>=5.0"',
        "tailwind.config.ts": "  \n",
        "vercel.json": "{ not-json",
        Dockerfile: "# FROM node:20 is an example",
        "pytest.ini": "[tooling]\npytest = true",
      },
      (repoPath) => {
        expect(detectTechnicalDecisions(repoPath)).toEqual({ decisions: [], evidence: [] });
      }
    );
  });

  it("rejects unsupported package metadata shapes and comment-only config", () => {
    withRepo(
      {
        "package.json": JSON.stringify({
          dependencies: ["next"],
          devDependencies: {
            react: { version: "19.0.0" },
            vitest: false,
          },
        }),
        "tailwind.config.js": [
          "/* export default {} */",
          '// module.exports = {}',
          'const example = "export default {}";',
        ].join("\n"),
      },
      (repoPath) => {
        expect(detectTechnicalDecisions(repoPath)).toEqual({ decisions: [], evidence: [] });
      }
    );
  });

  it("rejects directories, symlinks, unreadable files, and escaped sources", () => {
    const repoPath = fs.mkdtempSync(path.join(os.tmpdir(), "repoatlas-decisions-"));
    const outsidePath = fs.mkdtempSync(path.join(os.tmpdir(), "repoatlas-decisions-outside-"));
    const originalReadFile = fs.readFileSync;

    try {
      fs.mkdirSync(path.join(repoPath, "tailwind.config.ts"));
      fs.mkdirSync(path.join(repoPath, "pytest.ini"));
      fs.writeFileSync(path.join(outsidePath, "vercel.json"), "{}");
      fs.symlinkSync(path.join(outsidePath, "vercel.json"), path.join(repoPath, "vercel.json"));
      fs.writeFileSync(path.join(repoPath, "Dockerfile"), "FROM node:20");
      vi.spyOn(fs, "readFileSync").mockImplementation((file, ...args) => {
        if (path.resolve(String(file)) === path.join(repoPath, "Dockerfile")) {
          throw new Error("unreadable");
        }
        return originalReadFile(file, ...args);
      });

      expect(detectTechnicalDecisions(repoPath)).toEqual({ decisions: [], evidence: [] });
    } finally {
      vi.restoreAllMocks();
      fs.rmSync(repoPath, { recursive: true, force: true });
      fs.rmSync(outsidePath, { recursive: true, force: true });
    }
  });
});
