import { cache } from 'react';
import type { Bootstrap, Category, Product, Settings } from '../types';
import { getBootstrap } from './commerce';
import { getSession, SESSION_COOKIE } from './security';
import { readStore } from './storage';

/**
 * Server-side data access with two modes:
 *  - default: the JSON store lives on this machine (one persistent server);
 *  - API_ORIGIN set: this machine only renders UI and asks the persistent API server.
 *
 * The second mode exists because serverless hosts (Vercel) cannot keep JSON files.
 */
export function normalizeApiOrigin(raw?: string | null): string | null {
  const value = (raw ?? '').trim().replace(/\/+$/, '');
  if (!value) return null;
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error('API_ORIGIN noto‘g‘ri manzil. Masalan: https://api.mening-dokonim.uz');
  }
  const local = ['localhost', '127.0.0.1', '::1', '[::1]'].includes(url.hostname);
  if (url.protocol !== 'https:' && !(local && url.protocol === 'http:'))
    throw new Error(
      'API_ORIGIN https:// bo‘lishi shart (faqat localhost uchun http:// ruxsat etiladi).',
    );
  if (url.pathname !== '/' || url.search || url.hash || url.username || url.password)
    throw new Error('API_ORIGIN faqat manzil bo‘lsin, masalan https://api.mening-dokonim.uz');
  return url.origin;
}
export function apiOrigin(): string | null {
  return normalizeApiOrigin(process.env.API_ORIGIN);
}
export function remoteMode() {
  return Boolean((process.env.API_ORIGIN || '').trim());
}
async function remote<T>(path: string, options: { cookie?: string } = {}): Promise<T> {
  const origin = apiOrigin();
  if (!origin) throw new Error('API_ORIGIN sozlanmagan.');
  const response = await fetch(origin + '/api' + path, {
    cache: 'no-store',
    signal: AbortSignal.timeout(15000),
    headers: {
      accept: 'application/json',
      ...(options.cookie ? { cookie: options.cookie } : {}),
    },
  });
  const data: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const message =
      data && typeof data === 'object' && 'error' in data
        ? String((data as { error: unknown }).error)
        : '';
    throw new Error(message || 'Backend server javob bermadi.');
  }
  return data as T;
}
/**
 * Settings for chrome/metadata. Returns null when the shop has no usable data source,
 * so pages can explain the fix instead of crashing.
 */
export const trySettings = cache(async (): Promise<Settings | null> => {
  try {
    return await loadSettings();
  } catch {
    return null;
  }
});
/** Why the shop cannot show data right now. */
export type DataSourceIssue = 'api-origin' | 'upstream' | 'storage';
export function dataSourceIssue(): DataSourceIssue {
  if (remoteMode()) return apiOrigin() ? 'upstream' : 'api-origin';
  // A serverless host has no durable disk, so the fix is API_ORIGIN, not a local path.
  if (process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.NETLIFY)
    return 'api-origin';
  return 'storage';
}
export const loadSettings = cache(async (): Promise<Settings> =>
  remoteMode()
    ? (await remote<{ settings: Settings }>('/bootstrap')).settings
    : readStore('settings'),
);
export const loadBootstrap = cache(async (): Promise<Bootstrap> =>
  remoteMode() ? remote<Bootstrap>('/bootstrap') : getBootstrap(),
);
export const loadCategories = cache(async (): Promise<Category[]> => {
  try {
    return remoteMode()
      ? (await remote<{ categories: Category[] }>('/bootstrap')).categories
      : await readStore('categories');
  } catch {
    return [];
  }
});
/** Every enabled product, across all API pages (the catalog caps a page at 48 items). */
export const loadAllProducts = cache(async (): Promise<Product[]> => {
  if (!remoteMode()) return readStore('products');
  const products: Product[] = [];
  for (let page = 1; page <= 100; page++) {
    const result = await remote<{ products: Product[]; pages: number }>(
      `/products?limit=48&page=${page}`,
    );
    products.push(...result.products);
    if (page >= result.pages) break;
  }
  return products;
});
export const loadProduct = cache(async (id: string): Promise<Product | null> => {
  if (!remoteMode()) {
    try {
      return (await readStore('products')).find((p) => p.id === id) || null;
    } catch {
      return null;
    }
  }
  try {
    return (await remote<{ product: Product }>(`/products/${encodeURIComponent(id)}`)).product;
  } catch {
    return null;
  }
});
/** Validates an administrator session cookie, locally or against the API server. */
export async function loadAdminSession(token?: string) {
  if (!token) return null;
  if (!remoteMode()) return getSession(token);
  try {
    return await remote<{ username: string }>('/admin/session', {
      cookie: `${SESSION_COOKIE}=${token}`,
    });
  } catch {
    return null;
  }
}
