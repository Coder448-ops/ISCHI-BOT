import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import type { NextRequest } from 'next/server';
import { getDb } from './db';
import { ApiError } from './orders';

export const SESSION_COOKIE = 'ischi_admin';
const SESSION_SECONDS = 8 * 60 * 60;
const hash = (value: string) => createHash('sha256').update(value).digest();
export function adminConfigured() {
  return Boolean(process.env.ADMIN_PASSWORD && process.env.ADMIN_PASSWORD.length >= 12);
}
export function verifyCredentials(username: string, password: string) {
  return (
    adminConfigured() &&
    timingSafeEqual(hash(username), hash(process.env.ADMIN_USERNAME || 'admin')) &&
    timingSafeEqual(hash(password), hash(process.env.ADMIN_PASSWORD!))
  );
}
export function createSession(username: string, secure: boolean) {
  const db = getDb();
  const token = randomBytes(32).toString('base64url');
  const now = Date.now();
  db.prepare('DELETE FROM admin_sessions WHERE expires_at < ?').run(now);
  db.prepare(
    'INSERT INTO admin_sessions (token_hash, username, expires_at, created_at) VALUES (?, ?, ?, ?)',
  ).run(hash(token).toString('hex'), username, now + SESSION_SECONDS * 1000, now);
  return {
    token,
    options: {
      httpOnly: true,
      secure,
      sameSite: 'strict' as const,
      path: '/',
      maxAge: SESSION_SECONDS,
    },
  };
}
export function requireAdmin(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (!token || !/^[A-Za-z0-9_-]{43}$/.test(token))
    throw new ApiError(401, 'Administrator sifatida kiring.');
  const session = getDb()
    .prepare('SELECT username FROM admin_sessions WHERE token_hash = ? AND expires_at > ?')
    .get(hash(token).toString('hex'), Date.now()) as { username: string } | undefined;
  if (!session || !adminConfigured()) throw new ApiError(401, 'Administrator sifatida kiring.');
  return session;
}
export function deleteSession(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (token)
    getDb()
      .prepare('DELETE FROM admin_sessions WHERE token_hash = ?')
      .run(hash(token).toString('hex'));
}
const globalLimits = globalThis as unknown as {
  loginLimits?: Map<string, { count: number; until: number }>;
};
export function checkLoginLimit(request: NextRequest) {
  const limits = (globalLimits.loginLimits ??= new Map());
  const now = Date.now();
  if (limits.size > 5000)
    for (const [key, value] of limits) if (value.until < now) limits.delete(key);
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'local';
  let denied = false;
  for (const key of [hash(ip).toString('hex'), 'all-admin-login']) {
    let bucket = limits.get(key);
    if (!bucket || bucket.until < now) {
      bucket = { count: 0, until: now + 15 * 60 * 1000 };
      limits.set(key, bucket);
    }
    bucket.count++;
    if (bucket.count > (key === 'all-admin-login' ? 100 : 8)) denied = true;
  }
  if (denied)
    throw new ApiError(429, 'Juda ko‘p urinish. 15 daqiqadan so‘ng qayta urinib ko‘ring.');
}
export function isSecureRequest(request: NextRequest) {
  return (
    request.nextUrl.protocol === 'https:' || request.headers.get('x-forwarded-proto') === 'https'
  );
}
