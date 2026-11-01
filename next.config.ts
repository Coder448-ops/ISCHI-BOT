import type { NextConfig } from 'next';
const nextConfig: NextConfig = {
  allowedDevOrigins: ['*.e2b.app', '*.arena.ai'],
  poweredByHeader: false,
  output: 'standalone',
  serverExternalPackages: ['sharp', 'proper-lockfile'],
  outputFileTracingExcludes: {
    '/*': [
      './data/**/*',
      './.env*',
      './test-results/**/*',
      './playwright-report/**/*',
      './android/**/*',
      './dist-mobile/**/*',
    ],
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
      { source: '/admin/:path*', headers: [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }] },
      { source: '/api/:path*', headers: [{ key: 'Cache-Control', value: 'no-store' }] },
    ];
  },
};
export default nextConfig;
