import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const securityHeaders = require("../../securityHeaders.js") as {
  CONTENT_SECURITY_POLICY: string;
  getSecurityHeaders: (production?: boolean) => Array<{ key: string; value: string }>;
};

describe("production security headers", () => {
  it("keeps development headers free of production-only CSP and HSTS", () => {
    const keys = securityHeaders.getSecurityHeaders(false).map((header) => header.key);

    expect(keys).not.toContain("Content-Security-Policy");
    expect(keys).not.toContain("Strict-Transport-Security");
    expect(keys).toContain("X-Content-Type-Options");
  });

  it("declares the capabilities used by the production app and exports", () => {
    const headers = securityHeaders.getSecurityHeaders(true);
    const csp = headers.find((header) => header.key === "Content-Security-Policy")?.value;

    expect(csp).toBe(securityHeaders.CONTENT_SECURITY_POLICY);
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain(
      "script-src 'self' 'unsafe-inline' https://us-assets.i.posthog.com"
    );
    expect(csp).toContain("style-src 'self' 'unsafe-inline'");
    expect(csp).toContain(
      "connect-src 'self' https://us.i.posthog.com https://us-assets.i.posthog.com"
    );
    expect(csp).toContain("img-src 'self' data: blob:");
    expect(csp).toContain("font-src 'self' data:");
    expect(csp).toContain("worker-src 'self' blob:");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("frame-src 'none'");
    expect(csp).not.toContain("unsafe-eval");
  });
});
