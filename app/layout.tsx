import type { Metadata, Viewport } from 'next';
import './globals.css';
export const metadata: Metadata = {
  title: {
    default: 'ISCHI Industrial — Metall va qurilish materiallari',
    template: '%s | ISCHI Industrial',
  },
  description: 'Metall prokati va qurilish materiallari. Ro‘yxatdan o‘tmasdan buyurtma bering.',
  applicationName: 'ISCHI Industrial',
  robots: { index: true, follow: true },
};
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#191d1b',
};
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="uz" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
