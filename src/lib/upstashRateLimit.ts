/**
 * Optional Upstash Redis REST rate limiter (distributed across serverless isolates).
 * Uses the REST API with fetch — no extra SDK dependency.
 */

import type { RateLimiter, RateLimitResult } from "@/lib/rateLimit";

const WINDOW_MS = 60_000;

function maxPerWindow(): number {
  const raw = process.env.ANALYZE_RATE_LIMIT_PER_MIN;
  if (raw != null && raw !== "") {
    const n = Number(raw);
    if (Number.isFinite(n)) return Math.floor(n);
  }
  return 30;
}

export function upstashConfigFromEnv(): { url: string; token: string } | null {
  const url = process.env.UPSTASH_REDIS_REST_URL?.trim();
  const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();
  if (!url || !token) return null;
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  if (parsed.protocol !== "https:") return null;
  const host = parsed.hostname.toLowerCase();
  if (!(host === "upstash.io" || host.endsWith(".upstash.io"))) return null;
  return { url, token };
}

async function upstashCommand(
  url: string,
  token: string,
  command: Array<string | number>
): Promise<unknown> {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(command),
    signal: AbortSignal.timeout(3_000),
  });
  if (!response.ok) {
    throw new Error(`Upstash command failed with ${response.status}`);
  }
  const payload = (await response.json()) as { result?: unknown };
  return payload.result;
}

/**
 * Fixed-window counter in Redis. Durable across isolates when Upstash is configured.
 */
export class UpstashRedisRateLimiter implements RateLimiter {
  constructor(
    private readonly url: string,
    private readonly token: string,
    private readonly windowMs = WINDOW_MS,
    private readonly limit = maxPerWindow()
  ) {}

  async check(key: string): Promise<RateLimitResult> {
    if (this.limit <= 0) {
      return { allowed: true, bestEffort: false };
    }

    const bucket = Math.floor(Date.now() / this.windowMs);
    const redisKey = `repoatlas:analyze:${key}:${bucket}`;
    try {
      const count = Number(await upstashCommand(this.url, this.token, ["INCR", redisKey]));
      if (count === 1) {
        await upstashCommand(this.url, this.token, [
          "PEXPIRE",
          redisKey,
          this.windowMs,
        ]);
      }
      if (count > this.limit) {
        const retryAfterMs = this.windowMs - (Date.now() % this.windowMs);
        return { allowed: false, retryAfterMs, bestEffort: false };
      }
      return { allowed: true, bestEffort: false };
    } catch {
      // Fail open to in-memory semantics would require a second limiter; callers
      // that wrap this should fall back. We deny-open (allow) on store outage so
      // analysis availability is preserved, and mark bestEffort.
      return { allowed: true, bestEffort: true };
    }
  }
}
