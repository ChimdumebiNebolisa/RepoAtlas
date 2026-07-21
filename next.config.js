/** @type {import('next').NextConfig} */

// CSP is emitted only in production: Next's development HMR runtime needs
// development-only capabilities that must not be granted to deployed users.
const { getSecurityHeaders } = require('./securityHeaders');
const securityHeaders = getSecurityHeaders();

const nextConfig = {
  serverExternalPackages: [],
  productionBrowserSourceMaps: true,
  // The bundled sample is read as a directory at runtime. Include every
  // evidence file explicitly so the deployed API analyzes the same fixture
  // that the statically generated homepage preview uses during the build.
  outputFileTracingIncludes: {
    '/api/analyze': ['./fixtures/repo-ts/**/*'],
  },
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
