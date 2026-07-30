import { describe, expect, it } from "vitest";
import {
  candidateBriefLanguageCoverage,
  candidateBriefWalkthroughOutputs,
} from "./candidateBriefContent";

describe("candidate brief content contract", () => {
  it("keeps the homepage and interview page aligned on the four walkthrough outputs", () => {
    expect(candidateBriefWalkthroughOutputs.map(({ title }) => title)).toEqual([
      "Start in the right place",
      "Explain the system",
      "Prepare for follow-up questions",
      "Support what you say",
    ]);
    expect(new Set(candidateBriefWalkthroughOutputs.map(({ title }) => title)).size).toBe(4);
  });

  it("names only the proven deep language paths", () => {
    expect(candidateBriefLanguageCoverage).toBe("TypeScript/JavaScript, Python, and Java");
  });
});
