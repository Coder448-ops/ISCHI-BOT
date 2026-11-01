export async function adminRequest<T>(path: string, method = 'GET', data?: unknown): Promise<T> {
  const response = await fetch('/api/admin' + path, {
    method,
    cache: 'no-store',
    headers:
      data instanceof FormData
        ? undefined
        : data
          ? { 'Content-Type': 'application/json' }
          : undefined,
    body: data instanceof FormData ? data : data ? JSON.stringify(data) : undefined,
  });
  if (response.status === 401) {
    window.location.assign('/admin/login');
    throw new Error('Administrator sifatida kiring.');
  }
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || 'Amalni bajarib bo‘lmadi.');
  return result as T;
}
export const slug = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 65);
