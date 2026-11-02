import type { MetadataRoute } from 'next';
import { trySettings } from '@/lib/server/data-source';
export const dynamic = 'force-dynamic';
export default async function robots(): Promise<MetadataRoute.Robots> {
  const settings = await trySettings();
  // Without a data source the shop is not live yet, so keep crawlers away.
  if (!settings) return { rules: [{ userAgent: '*', disallow: '/' }] };
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
