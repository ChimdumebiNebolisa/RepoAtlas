/**
 * Abuse protection for POST /api/analyze.
 *
 * IMPORTANT LIMITATION (read before relying on this for quotas):
 *   The default implementation here is a PROCESS-LOCAL, best-effort guard. On a
 *   serverless platform (e.g. Vercel) each invocation may run in a separate
 *   isolate, so an in-memory counter is NOT reliable distributed rate limiting.
 *   We deliberately do not pretend otherwise.
 *
 * What we DO provide safely without extra infrastructure:
 *   1. A concurrency gate — caps concurrent analyses per process. This bounds
 *      memory/CPU/temp-disk pressure regardless of how requests are distributed
 *      and is a legitimate conservative control.
 *   2. A best-effort per-key sliding window — reduces trivial single-instance
 *      bursts. Treat it as defense-in-depth, not a quota.
 *
 * To get durable, distributed rate limiting, implement {@link RateLimiter}
 * against a shared store (Redis, Upstash, Vercel KV, a database, or an API
 * gateway / WAF rule) and inject it via {@link setRateLimiter}. The interface
 * is intentionally isolated so swapping the backend requires no route changes.
 */

export interface RateLimitResult {
  allowed: boolean;
  /** Suggested wait before retrying, in milliseconds (when not allowed). */
  retryAfterMs?: number;
  /** True when the backend is only process-local / best-effort. */
  bestEffort: boolean;
}

export interface RateLimiter {
  /** Whether this request (identified by `key`) may proceed. */
  check(key: string): Promise<RateLimitResult>;
}

const WINDOW_MS = 60_000;

function defaultMaxPerWindow(): number {
  const raw = process.env.ANALYZE_RATE_LIMIT_PER_MIN;
  if (raw != null && raw !== "") {
    const n = Number(raw);
    // 0 or negative => disabled (unlimited). Useful for CI/e2e.
    if (Number.isFinite(n)) return Math.floor(n);
  }
  return 30;
}

/**
 * Best-effort, per-process sliding-window limiter. NOT distributed.
 */
export class InMemoryRateLimiter implements RateLimiter {
  private hits = new Map<string, number[]>();

  constructor(
    private readonly windowMs = WINDOW_MS,
    private readonly maxPerWindow = defaultMaxPerWindow()
  ) {}

  async check(key: string): Promise<RateLimitResult> {
    if (this.maxPerWindow <= 0) {
      return { allowed: true, bestEffort: true };
    }
    const now = Date.now();
    const cutoff = now - this.windowMs;
    const timestamps = (this.hits.get(key) ?? []).filter((t) => t > cutoff);

    if (timestamps.length >= this.maxPerWindow) {
      const oldest = timestamps[0];
      return {
        allowed: false,
        retryAfterMs: Math.max(0, oldest + this.windowMs - now),
        bestEffort: true,
      };
    }

    timestamps.push(now);
    this.hits.set(key, timestamps);
    return { allowed: true, bestEffort: true };
  }
}

let activeRateLimiter: RateLimiter = new InMemoryRateLimiter();
let rateLimiterConfigured = false;

/** Inject a durable, distributed limiter (e.g. Redis-backed) in production. */
export function setRateLimiter(limiter: RateLimiter): void {
  activeRateLimiter = limiter;
  rateLimiterConfigured = true;
}

/**
 * Make the process-wide startup choice once.
 *
 * Keeping the guard beside the active limiter prevents a reload of the startup
 * hook from replacing a healthy limiter that this module still owns.
 */
export function configureRateLimiterOnce(
  createLimiter: () => RateLimiter
): boolean {
  if (rateLimiterConfigured) return false;
  const limiter = createLimiter();
  activeRateLimiter = limiter;
  rateLimiterConfigured = true;
  return true;
}

export function getRateLimiter(): RateLimiter {
  return activeRateLimiter;
}

// --- Concurrency gate (process-local, but a valid conservative control) ------

const MAX_CONCURRENT_ANALYSES = (() => {
  const raw = process.env.MAX_CONCURRENT_ANALYSES;
  if (raw) {
    const n = Number(raw);
    if (Number.isFinite(n) && n > 0) return Math.floor(n);
  }
  return 4;
})();

let activeAnalyses = 0;

export interface AnalysisSlot {
  release(): void;
}

/**
 * Try to acquire a concurrency slot. Returns null when the process is already
 * at capacity (caller should respond 429). Always release in a finally block.
 */
export function tryAcquireAnalysisSlot(): AnalysisSlot | null {
  if (activeAnalyses >= MAX_CONCURRENT_ANALYSES) return null;
  activeAnalyses += 1;
  let released = false;
  return {
    release() {
      if (released) return;
      released = true;
      activeAnalyses = Math.max(0, activeAnalyses - 1);
    },
  };
}

export function getMaxConcurrentAnalyses(): number {
  return MAX_CONCURRENT_ANALYSES;
}

/** Derive a coarse client key for best-effort limiting from request headers. */
export function clientKeyFromHeaders(headers: Headers): string {
  const fwd = headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]!.trim();
  return headers.get("x-real-ip") ?? "unknown";
}
