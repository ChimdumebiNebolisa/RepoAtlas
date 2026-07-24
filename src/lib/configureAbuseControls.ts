/**
 * Wire durable abuse controls when shared infrastructure is configured.
 */

import {
  configureRateLimiterOnce,
  InMemoryRateLimiter,
} from "@/lib/rateLimit";
import { UpstashRedisRateLimiter, upstashConfigFromEnv } from "@/lib/upstashRateLimit";

/** Idempotent startup hook — prefer Upstash Redis when credentials exist. */
export function configureAbuseControls(): void {
  configureRateLimiterOnce(() => {
    const upstash = upstashConfigFromEnv();
    if (upstash) {
      return new UpstashRedisRateLimiter(upstash.url, upstash.token);
    }
    return new InMemoryRateLimiter();
  });
}
