import type { CartLine, Receipt } from './types';
export class RequestError extends Error {
  constructor(
    message: string,
    public status = 0,
    public field?: string,
  ) {
    super(message);
  }
}
export function createClient(base = '') {
  async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
    try {
      const response = await fetch(base + '/api' + path, {
        ...options,
        cache: 'no-store',
        headers: {
          ...(options.body ? { 'Content-Type': 'application/json' } : {}),
          ...options.headers,
        },
      });
      const data = await response.json();
      if (!response.ok)
        throw new RequestError(data.error || 'So‘rov bajarilmadi.', response.status, data.field);
      return data as T;
    } catch (error) {
      if (error instanceof RequestError) throw error;
      throw new RequestError(
        navigator.onLine ? 'Server bilan ulanishda xatolik.' : 'Internet aloqasi yo‘q.',
      );
    }
  }
  return {
    request,
    get: <T>(path: string) => request<T>(path),
    post: <T>(path: string, data: unknown) =>
      request<T>(path, { method: 'POST', body: JSON.stringify(data) }),
    image: (url: string) => (url.startsWith('/') ? base + url : url),
  };
}
export function readLocal<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem('ischi-v2-' + key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
export function writeLocal(key: string, value: unknown) {
  try {
    localStorage.setItem('ischi-v2-' + key, JSON.stringify(value));
  } catch {
    /* Private browsing may disable storage. */
  }
}
export function validCart(value: unknown): CartLine[] {
  return Array.isArray(value)
    ? value
        .filter(
          (x) =>
            x && typeof x.productId === 'string' && Number.isFinite(x.quantity) && x.quantity > 0,
        )
        .slice(0, 50)
    : [];
}
export function validReceipts(value: unknown): Receipt[] {
  return Array.isArray(value)
    ? value
        .filter(
          (x) =>
            x &&
            typeof x.id === 'string' &&
            typeof x.number === 'string' &&
            typeof x.token === 'string',
        )
        .slice(0, 50)
    : [];
}
