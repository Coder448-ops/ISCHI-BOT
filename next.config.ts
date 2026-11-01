import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  allowedDevOrigins: ['*.e2b.app', '*.arena.ai'],
  poweredByHeader: false,
  outputFileTracingExcludes: {
    '/*': ['./.data/**/*', './.env*', './test-results/**/*', './playwright-report/**/*'],
  },
  serverExternalPackages: ['node:sqlite'],
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
      {
        source: '/admin/:path*',
        headers: [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }],
      },
    ];
  },
};
export default nextConfig;
