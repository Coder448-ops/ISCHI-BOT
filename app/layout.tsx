import type { Metadata, Viewport } from 'next';
import '@fontsource-variable/manrope';
import '@fontsource-variable/dm-sans';
import './globals.css';

export const metadata: Metadata = {
  title: { default: 'ISCHI — Texnika oson tanlanadi', template: '%s | ISCHI' },
  description:
    'Sevimli texnikangizni ro‘yxatdan o‘tmasdan buyurtma qiling. Faqat ism, familiya va telefon raqamingiz yetarli.',
  robots: { index: true, follow: true },
};
export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: '#215747' };
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="uz">
      <body>{children}</body>
    </html>
  );
}
