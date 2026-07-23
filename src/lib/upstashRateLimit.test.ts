import { afterEach, describe, expect, it, vi } from "vitest";
import {
  UpstashRedisRateLimiter,
  upstashConfigFromEnv,
} from "./upstashRateLimit";

function redisResponse(result: unknown): Response {
  return new Response(JSON.stringify({ result }), { status: 200 });
}

describe("upstashConfigFromEnv", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("requires both configuration values", () => {
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "");
    expect(upstashConfigFromEnv()).toBeNull();

    vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://repoatlas.upstash.io");
    expect(upstashConfigFromEnv()).toBeNull();

    vi.stubEnv("UPSTASH_REDIS_REST_URL", "");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "token");
    expect(upstashConfigFromEnv()).toBeNull();
  });

  it.each([
    "not-a-url",
    "http://repoatlas.upstash.io",
    "https://example.com",
    "https://upstash.io.example.com",
  ])("rejects an unsafe Redis URL: %s", (url) => {
    vi.stubEnv("UPSTASH_REDIS_REST_URL", url);
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "token");
    expect(upstashConfigFromEnv()).toBeNull();
  });

  it.each([
    "https://upstash.io",
    "https://repoatlas.upstash.io",
  ])("accepts an HTTPS Upstash host: %s", (url) => {
    vi.stubEnv("UPSTASH_REDIS_REST_URL", `  ${url}  `);
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "  token  ");
    expect(upstashConfigFromEnv()).toEqual({ url, token: "token" });
  });
});

describe("UpstashRedisRateLimiter", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("expires a new counter and allows the first request", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(redisResponse(1))
      .mockResolvedValueOnce(redisResponse(1));
    vi.stubGlobal("fetch", fetchMock);
    vi.spyOn(Date, "now").mockReturnValue(120_000);

    const limiter = new UpstashRedisRateLimiter(
      "https://repoatlas.upstash.io",
      "token",
      60_000,
      2
    );
    await expect(limiter.check("1.1.1.1")).resolves.toEqual({
      allowed: true,
      bestEffort: false,
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(JSON.parse(fetchMock.mock.calls[0]![1]!.body as string)).toEqual([
      "INCR",
      "repoatlas:analyze:1.1.1.1:2",
    ]);
    expect(JSON.parse(fetchMock.mock.calls[1]![1]!.body as string)).toEqual([
      "PEXPIRE",
      "repoatlas:analyze:1.1.1.1:2",
      60_000,
    ]);
    expect(fetchMock.mock.calls[0]![1]).toMatchObject({
      method: "POST",
      headers: {
        Authorization: "Bearer token",
        "Content-Type": "application/json",
      },
    });
  });

  it("allows the exact threshold and blocks the next request", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(redisResponse("2"))
      .mockResolvedValueOnce(redisResponse(3));
    vi.stubGlobal("fetch", fetchMock);
    vi.spyOn(Date, "now").mockReturnValue(120_001);

    const limiter = new UpstashRedisRateLimiter(
      "https://repoatlas.upstash.io",
      "token",
      60_000,
      2
    );
    await expect(limiter.check("client")).resolves.toEqual({
      allowed: true,
      bestEffort: false,
    });
    await expect(limiter.check("client")).resolves.toEqual({
      allowed: false,
      retryAfterMs: 59_999,
      bestEffort: false,
    });
  });

  it("returns the full retry window at an exact boundary", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(redisResponse(3)));
    vi.spyOn(Date, "now").mockReturnValue(120_000);
    const limiter = new UpstashRedisRateLimiter(
      "https://repoatlas.upstash.io",
      "token",
      60_000,
      2
    );

    await expect(limiter.check("client")).resolves.toEqual({
      allowed: false,
      retryAfterMs: 60_000,
      bestEffort: false,
    });
  });

  it("uses the configured limit and the default for invalid configuration", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(redisResponse(2))
      .mockResolvedValueOnce(redisResponse(3))
      .mockResolvedValueOnce(redisResponse(30))
      .mockResolvedValueOnce(redisResponse(31));
    vi.stubGlobal("fetch", fetchMock);
    vi.spyOn(Date, "now").mockReturnValue(120_000);

    vi.stubEnv("ANALYZE_RATE_LIMIT_PER_MIN", "2.9");
    const configured = new UpstashRedisRateLimiter(
      "https://repoatlas.upstash.io",
      "token"
    );
    await expect(configured.check("configured")).resolves.toMatchObject({
      allowed: true,
    });
    await expect(configured.check("configured")).resolves.toMatchObject({
      allowed: false,
    });

    vi.stubEnv("ANALYZE_RATE_LIMIT_PER_MIN", "invalid");
    const defaulted = new UpstashRedisRateLimiter(
      "https://repoatlas.upstash.io",
      "token"
    );
    await expect(defaulted.check("defaulted")).resolves.toMatchObject({
      allowed: true,
    });
    await expect(defaulted.check("defaulted")).resolves.toMatchObject({
      allowed: false,
    });
  });

  it("can disable the distributed limit without contacting Redis", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    vi.stubEnv("ANALYZE_RATE_LIMIT_PER_MIN", "0");
    const limiter = new UpstashRedisRateLimiter(
      "https://repoatlas.upstash.io",
      "token"
    );

    await expect(limiter.check("client")).resolves.toEqual({
      allowed: true,
      bestEffort: false,
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("uses a three-second request deadline", async () => {
    const signal = new AbortController().signal;
    const timeoutSpy = vi
      .spyOn(AbortSignal, "timeout")
      .mockReturnValue(signal);
    const fetchMock = vi.fn().mockResolvedValue(redisResponse(2));
    vi.stubGlobal("fetch", fetchMock);
    const limiter = new UpstashRedisRateLimiter(
      "https://repoatlas.upstash.io",
      "token",
      60_000,
      2
    );

    await limiter.check("client");

    expect(timeoutSpy).toHaveBeenCalledWith(3_000);
    expect(fetchMock.mock.calls[0]![1]).toMatchObject({ signal });
  });

  it.each([
    ["network failure", () => Promise.reject(new Error("network"))],
    [
      "request timeout",
      () => Promise.reject(new DOMException("timed out", "TimeoutError")),
    ],
    [
      "HTTP failure",
      () => Promise.resolve(new Response("unavailable", { status: 503 })),
    ],
    [
      "invalid JSON",
      () => Promise.resolve(new Response("not-json", { status: 200 })),
    ],
    [
      "expiry failure",
      vi
        .fn()
        .mockResolvedValueOnce(redisResponse(1))
        .mockResolvedValueOnce(new Response("unavailable", { status: 503 })),
    ],
  ])("fails open as best effort after a %s", async (_label, implementation) => {
    vi.stubGlobal("fetch", vi.fn(implementation));
    const limiter = new UpstashRedisRateLimiter(
      "https://repoatlas.upstash.io",
      "token",
      60_000,
      2
    );

    await expect(limiter.check("client")).resolves.toEqual({
      allowed: true,
      bestEffort: true,
    });
  });

  it.each([
    ["missing", undefined],
    ["nonnumeric", "not-a-number"],
    ["empty", "   "],
    ["null", null],
    ["zero", 0],
    ["negative", -1],
    ["fractional", 1.5],
    ["object", { count: 1 }],
  ])("marks a %s counter result as best effort", async (_label, result) => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(redisResponse(result)));
    const limiter = new UpstashRedisRateLimiter(
      "https://repoatlas.upstash.io",
      "token",
      60_000,
      2
    );

    await expect(limiter.check("client")).resolves.toEqual({
      allowed: true,
      bestEffort: true,
    });
  });
});
