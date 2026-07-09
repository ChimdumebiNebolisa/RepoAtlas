import { describe, it } from "vitest";
import fs from "fs";
import path from "path";
import { buildSampleReport } from "@/lib/buildSampleReport";
import { exportReportToMarkdown } from "@/lib/export";

describe("write example brief", () => {
  it("writes docs/examples/repoatlas-candidate-brief.md", () => {
    const outDir = path.join(process.cwd(), "docs", "examples");
    fs.mkdirSync(outDir, { recursive: true });
    const report = buildSampleReport();
    const header = `<!-- Generated from buildSampleReport() in src/lib/buildSampleReport.ts — bundled sample output, not from a live deployment. -->

# Example Candidate Brief (sample output)

RepoAtlas produces deterministic, evidence-backed Candidate Briefs **without AI**. This file shows the Markdown export shape for the bundled homepage sample report (\`repo-atlas\`).

---

`;
    const body = exportReportToMarkdown(report);
    fs.writeFileSync(
      path.join(outDir, "repoatlas-candidate-brief.md"),
      `${header}${body}`
    );
  });
});
