import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { analyzeBundledSample } from "./bundledSample";

const ESTABLISHED_SAMPLE_BRIEF_HASH =
  "86ab059057ddc26c9a190f5757dcccce4d84074e244b0afec01d00aaa355a178";

describe("bundled sample Candidate Brief", () => {
  it("preserves the exact established output through the shared sample entrance", async () => {
    const result = await analyzeBundledSample();
    const serialized = JSON.stringify(result.report.candidate_brief);
    const digest = createHash("sha256").update(serialized).digest("hex");

    expect(result.persisted).toBe(false);
    expect(result.report.analysis_intent).toBe("interview");
    expect(digest).toBe(ESTABLISHED_SAMPLE_BRIEF_HASH);
  }, 30_000);
});
