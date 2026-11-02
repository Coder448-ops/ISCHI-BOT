import type { Metadata } from 'next';
import { StoreApp } from '@/components/store-app';
import { trySettings } from '@/lib/server/data-source';
import { SetupNotice } from '@/components/setup-notice';
export const dynamic = 'force-dynamic';
export async function generateMetadata(): Promise<Metadata> {
  const settings = await trySettings();
  if (!settings) return { title: 'Sozlash kerak', robots: { index: false, follow: false } };
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
export default async function HomePage() {
  if (!(await trySettings())) return <SetupNotice missing="api-origin" />;
  return <StoreApp initialPath="/" />;
}
