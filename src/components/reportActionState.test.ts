import { describe, expect, it } from "vitest";
import { describeMarkdownExportFailure } from "./reportActionState";

describe("report action state messages", () => {
  it("adds Markdown route context to a bounded API error", () => {
    expect(describeMarkdownExportFailure(undefined, 503)).toBe(
      "Markdown export failed (HTTP 503). Analysis failed. Check server logs."
    );
  });
});
