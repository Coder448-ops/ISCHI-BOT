import type { MetadataRoute } from 'next';
import { readStore } from '@/lib/server/storage';
export const dynamic = 'force-dynamic';
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [settings, products] = await Promise.all([readStore('settings'), readStore('products')]);
  const base = settings.websiteUrl || process.env.PUBLIC_WEB_ORIGIN?.split(',')[0]?.trim();
  if (!base) return [];
  const paths = [
    '',
    '/catalog',
    '/about',
    '/contact',
    '/delivery',
    '/payment',
    '/privacy',
    '/faq',
    '/install',
  ];
  return [
    ...paths.map((path) => ({
      url: base + path,
      changeFrequency: 'weekly' as const,
      priority: path === '' ? 1 : 0.6,
    })),
    ...products
      .filter((p) => p.enabled)
      .map((p) => ({
        url: base + '/product/' + encodeURIComponent(p.id),
        lastModified: new Date(p.updatedAt),
        changeFrequency: 'weekly' as const,
        priority: 0.8,
      })),
  ];
}
