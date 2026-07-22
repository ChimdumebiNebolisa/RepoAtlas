import { describe, expect, it, vi, afterEach } from "vitest";
import { UpstashRedisRateLimiter } from "./upstashRateLimit";

describe("UpstashRedisRateLimiter", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("allows traffic under the window limit and blocks after", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    fetchMock
      .mockResolvedValueOnce(new Response(JSON.stringify({ result: 1 }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ result: 1 }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ result: 3 }), { status: 200 }));

    const limiter = new UpstashRedisRateLimiter("https://example.upstash.io", "token", 60_000, 2);
    await expect(limiter.check("1.1.1.1")).resolves.toMatchObject({
      allowed: true,
      bestEffort: false,
    });
    await expect(limiter.check("1.1.1.1")).resolves.toMatchObject({
      allowed: false,
      bestEffort: false,
    });
    expect(fetchMock).toHaveBeenCalled();
  });

  it("fails open as best-effort when Upstash is unreachable", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network")));
    const limiter = new UpstashRedisRateLimiter("https://example.upstash.io", "token", 60_000, 2);
    await expect(limiter.check("client")).resolves.toEqual({
      allowed: true,
      bestEffort: true,
    });
  });
});
