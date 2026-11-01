import type { MetadataRoute } from 'next';
import { readStore } from '@/lib/server/storage';
export const dynamic = 'force-dynamic';
export default async function robots(): Promise<MetadataRoute.Robots> {
  const settings = await readStore('settings');
  const base = settings.websiteUrl || process.env.PUBLIC_WEB_ORIGIN?.split(',')[0]?.trim();
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/admin/', '/api/', '/checkout', '/orders', '/favorites', '/compare', '/recent'],
      },
    ],
    ...(base ? { sitemap: base + '/sitemap.xml' } : {}),
  };
}
