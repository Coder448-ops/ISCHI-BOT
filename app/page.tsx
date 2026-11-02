import type { Metadata } from 'next';
import { StoreApp } from '@/components/store-app';
import { readStore } from '@/lib/server/storage';
export const dynamic = 'force-dynamic';
export async function generateMetadata(): Promise<Metadata> {
  const settings = await readStore('settings');
  const base = settings.websiteUrl || process.env.PUBLIC_WEB_ORIGIN?.split(',')[0]?.trim();
  return {
    title: settings.websiteTitle,
    description: settings.websiteDescription,
    ...(base
      ? {
          metadataBase: new URL(base),
          alternates: { canonical: '/' },
          openGraph: {
            title: settings.websiteTitle,
            description: settings.websiteDescription,
            url: '/',
            siteName: settings.companyName,
            locale: 'uz_UZ',
            type: 'website',
            images: ['/images/banners/industrial-hero.webp'],
          },
        }
      : {}),
  };
}
export default function HomePage() {
  return <StoreApp initialPath="/" />;
}
