/**
 * Wire durable abuse controls when shared infrastructure is configured.
 */

import { setRateLimiter, InMemoryRateLimiter } from "@/lib/rateLimit";
import { UpstashRedisRateLimiter, upstashConfigFromEnv } from "@/lib/upstashRateLimit";

let configured = false;

/** Idempotent startup hook — prefer Upstash Redis when credentials exist. */
export function configureAbuseControls(): void {
  if (configured) return;
  configured = true;
  const upstash = upstashConfigFromEnv();
  if (upstash) {
    setRateLimiter(new UpstashRedisRateLimiter(upstash.url, upstash.token));
    return;
  }
  setRateLimiter(new InMemoryRateLimiter());
}
