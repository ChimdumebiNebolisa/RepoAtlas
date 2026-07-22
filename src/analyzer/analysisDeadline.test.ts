import { describe, expect, it, vi } from "vitest";
import { createDeadlineChecker } from "./analysisDeadline";

describe("analysis deadline", () => {
  it("does not expire without a deadline", () => {
    expect(createDeadlineChecker().isExpired()).toBe(false);
  });

  it("expires when the wall-clock budget is spent", () => {
    vi.spyOn(Date, "now").mockReturnValueOnce(100).mockReturnValueOnce(110);
    expect(createDeadlineChecker(10).isExpired()).toBe(true);
  });

  it("treats cancellation as expired and throws the bounded timeout", () => {
    const controller = new AbortController();
    const deadline = createDeadlineChecker(10_000, controller.signal);
    controller.abort();

    expect(deadline.isExpired()).toBe(true);
    expect(() => deadline.throwIfAborted()).toThrowError(
      expect.objectContaining({ code: "TIMEOUT", status: 504 })
    );
  });
});
