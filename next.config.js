/** @type {import('next').NextConfig} */

// CSP is emitted only in production: Next's development HMR runtime needs
// development-only capabilities that must not be granted to deployed users.
const { getSecurityHeaders } = require('./securityHeaders');
const securityHeaders = getSecurityHeaders();

const nextConfig = {
  serverExternalPackages: [],
  async headers() {
    return [
      {
        source: '/:path*',
        headers: securityHeaders,
      },
    ];
  },
};

module.exports = nextConfig;
