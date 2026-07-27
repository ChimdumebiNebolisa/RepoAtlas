import { describe, expect, it } from "vitest";
import {
  describeMarkdownExportFailure,
  formatApiError,
} from "./reportActionState";

describe("report action state messages", () => {
  it.each([
    [null, "Fallback", "Fallback"],
    [{}, "Fallback", "Fallback"],
    [{ code: "FAILED" }, "Fallback", "FAILED"],
    [{ message: "Storage failed" }, "Fallback", "Storage failed"],
    [
      { code: "FAILED", message: "Storage failed" },
      "Fallback",
      "FAILED: Storage failed",
    ],
  ])("formats bounded API payloads", (payload, fallback, expected) => {
    expect(formatApiError(payload, fallback)).toBe(expected);
  });

  it("adds Markdown route context to a bounded API error", () => {
    expect(describeMarkdownExportFailure(undefined, 503)).toBe(
      "Markdown export failed (HTTP 503). Analysis failed. Check server logs."
    );
  });
});
