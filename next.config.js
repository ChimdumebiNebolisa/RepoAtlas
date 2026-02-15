/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ['mermaid'],
  },
};

module.exports = nextConfig;
