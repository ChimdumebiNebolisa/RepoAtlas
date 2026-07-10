import { describe, it, expect } from "vitest";
import {
  InMemoryRateLimiter,
  tryAcquireAnalysisSlot,
  getMaxConcurrentAnalyses,
  clientKeyFromHeaders,
} from "./rateLimit";

describe("InMemoryRateLimiter", () => {
  it("allows up to the limit then blocks with a retry hint", async () => {
    const limiter = new InMemoryRateLimiter(60_000, 2);
    expect((await limiter.check("a")).allowed).toBe(true);
    expect((await limiter.check("a")).allowed).toBe(true);
    const blocked = await limiter.check("a");
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterMs).toBeGreaterThanOrEqual(0);
    expect(blocked.bestEffort).toBe(true);
  });

  it("tracks keys independently", async () => {
    const limiter = new InMemoryRateLimiter(60_000, 1);
    expect((await limiter.check("a")).allowed).toBe(true);
    expect((await limiter.check("b")).allowed).toBe(true);
    expect((await limiter.check("a")).allowed).toBe(false);
  });

  it("treats a non-positive limit as disabled", async () => {
    const limiter = new InMemoryRateLimiter(60_000, 0);
    for (let i = 0; i < 100; i++) {
      expect((await limiter.check("a")).allowed).toBe(true);
    }
  });
});

describe("concurrency gate", () => {
  it("bounds concurrent slots and releases them", () => {
    const max = getMaxConcurrentAnalyses();
    const slots = [];
    for (let i = 0; i < max; i++) {
      const slot = tryAcquireAnalysisSlot();
      expect(slot).not.toBeNull();
      slots.push(slot);
    }
    expect(tryAcquireAnalysisSlot()).toBeNull();
    slots[0]!.release();
    const reacquired = tryAcquireAnalysisSlot();
    expect(reacquired).not.toBeNull();
    reacquired!.release();
    for (const s of slots.slice(1)) s!.release();
  });
});

describe("clientKeyFromHeaders", () => {
  it("prefers x-forwarded-for first hop", () => {
    const headers = new Headers({ "x-forwarded-for": "1.2.3.4, 5.6.7.8" });
    expect(clientKeyFromHeaders(headers)).toBe("1.2.3.4");
  });

  it("falls back to unknown", () => {
    expect(clientKeyFromHeaders(new Headers())).toBe("unknown");
  });
});
