import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const PAGE_DIR = path.join(process.cwd(), "src", "app", "code-review-interview");

function sourceLineCount(fileName: string) {
  return fs.readFileSync(path.join(PAGE_DIR, fileName), "utf8").split(/\r?\n/).length;
}

describe("code review interview guide boundaries", () => {
  it("keeps the page facade and focused presentation modules at or below 300 lines", () => {
    for (const fileName of [
      "page.tsx",
      "CodeReviewHero.tsx",
      "CodeReviewMethod.tsx",
      "CodeReviewExercise.tsx",
      "CodeReviewPreparation.tsx",
    ]) {
      expect(sourceLineCount(fileName), fileName).toBeLessThanOrEqual(300);
    }
  });
});
