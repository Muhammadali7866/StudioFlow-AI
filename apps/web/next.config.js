/** @type {import('next').NextConfig} */
const nextConfig = {
  // Required for apps/web/Dockerfile to produce .next/standalone output
  output: 'standalone',

  // Expose the API URL at build time for client-side fetching
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080',
  },

  // Silence ESLint errors during production builds (lint is run separately in CI)
  eslint: {
    ignoreDuringBuilds: true,
  },
};

module.exports = nextConfig;
