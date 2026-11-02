import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { StoreApp } from '@/components/store-app';
import {
  dataSourceIssue,
  loadCategories,
  loadProduct,
  trySettings,
} from '@/lib/server/data-source';
import { SetupNotice } from '@/components/setup-notice';
import { effectivePrice } from '@/lib/types';
export const dynamic = 'force-dynamic';
type Props = {
  params: Promise<{ slug: string[] }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};
const titles: Record<string, string> = {
  catalog: 'Katalog',
  about: 'Biz haqimizda',
  contact: 'Aloqa',
  delivery: 'Yetkazib berish',
  payment: 'To‘lov shartlari',
  privacy: 'Maxfiylik siyosati',
  faq: 'Savol-javoblar',
  install: 'Android ilova',
  favorites: 'Sevimlilar',
  compare: 'Taqqoslash',
  recent: 'Yaqinda ko‘rilgan',
  orders: 'Buyurtmalarim',
  checkout: 'Buyurtmani rasmiylashtirish',
};
const privatePages = ['checkout', 'orders', 'favorites', 'compare', 'recent'];
async function productFor(slug: string[]) {
  if (slug[0] !== 'product' || !slug[1]) return null;
  const [product, categories] = await Promise.all([loadProduct(slug[1]), loadCategories()]);
  return product &&
    product.enabled &&
    categories.some((c) => c.id === product.categoryId && c.enabled)
    ? product
    : null;
}
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const product = await productFor(slug);
  if (product)
    return {
      metadataBase: new URL(
        process.env.PUBLIC_WEB_ORIGIN?.split(',')[0]?.trim() || 'http://localhost:3000',
      ),
      title: product.name.uz,
      description: product.description.uz.slice(0, 300),
      alternates: { canonical: `/product/${product.id}` },
      openGraph: {
        title: product.name.uz,
        description: product.description.uz.slice(0, 300),
        images: product.images,
        type: 'website',
      },
    };
  return {
    title: titles[slug[0]] || 'Sahifa topilmadi',
    robots: privatePages.includes(slug[0]) ? { index: false, follow: false } : undefined,
  };
}
export default async function StorePage({ params, searchParams }: Props) {
  const { slug } = await params;
  const query = await searchParams;
  const settings = await trySettings();
  if (!settings) return <SetupNotice issue={dataSourceIssue()} />;
  if (slug.length !== 1 && !(slug.length === 2 && slug[0] === 'product')) notFound();
  if (slug.length === 1 && !titles[slug[0]]) notFound();
  const product = await productFor(slug);
  if (slug[0] === 'product' && !product) notFound();
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(query))
    if (typeof value === 'string') search.set(key, value);
  const base = settings.websiteUrl || process.env.PUBLIC_WEB_ORIGIN?.split(',')[0]?.trim();
  const jsonLd = product
    ? {
        '@context': 'https://schema.org',
        '@type': 'Product',
        name: product.name.uz,
        description: product.description.uz,
        sku: product.code,
        image: product.images.map((x) => (x.startsWith('/') && base ? base + x : x)),
        brand: product.manufacturer ? { '@type': 'Brand', name: product.manufacturer } : undefined,
        offers: {
          '@type': 'Offer',
          priceCurrency: 'UZS',
          price: effectivePrice(product),
          availability:
            product.stock >= product.minOrder
              ? 'https://schema.org/InStock'
              : 'https://schema.org/OutOfStock',
          ...(base ? { url: base + '/product/' + product.id } : {}),
        },
      }
    : null;
  return (
    <>
      {jsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }}
        />
      )}
      <StoreApp
        initialPath={
          '/' + slug.map(encodeURIComponent).join('/') + (search.size ? '?' + search : '')
        }
      />
    </>
  );
}
