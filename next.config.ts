import type { NextConfig } from 'next';
const nextConfig: NextConfig = {
  allowedDevOrigins: ['*.e2b.app', '*.arena.ai'],
  poweredByHeader: false,
  output: 'standalone',
  serverExternalPackages: ['sharp', 'proper-lockfile'],
  // Ko‘rgazma rejimi seeds/*.json ni o‘qiydi, shuning uchun ular serverless bundle ichida bo‘lsin.
  outputFileTracingIncludes: { '/*': ['./seeds/**/*'] },
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
          // Framing is restricted to this site plus the hosted preview origins.
          // Production Caddy replaces this with a self-only policy.
          {
            key: 'Content-Security-Policy',
            value: "frame-ancestors 'self' https://*.e2b.app https://*.arena.ai",
          },
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
