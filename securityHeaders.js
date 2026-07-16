const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "base-uri 'self'",
  "connect-src 'self'",
  "font-src 'self' data:",
  "form-action 'self'",
  "frame-ancestors 'self'",
  "frame-src 'none'",
  "img-src 'self' data: blob:",
  "object-src 'none'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "worker-src 'self' blob:",
].join('; ');

const BASE_SECURITY_HEADERS = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
  { key: 'X-DNS-Prefetch-Control', value: 'off' },
];

function getSecurityHeaders(production = process.env.NODE_ENV === 'production') {
  const headers = [...BASE_SECURITY_HEADERS];

  if (production) {
    headers.push(
      {
        key: 'Content-Security-Policy',
        value: CONTENT_SECURITY_POLICY,
      },
      {
        key: 'Strict-Transport-Security',
        value: 'max-age=63072000; includeSubDomains',
      },
    );
  }

  return headers;
}

module.exports = { CONTENT_SECURITY_POLICY, getSecurityHeaders };
