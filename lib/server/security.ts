import { createHash, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import type { NextRequest } from 'next/server';
import { ApiError, withStore } from './storage';
export const SESSION_COOKIE = 'ischi_admin';
const hash = (value: string) => createHash('sha256').update(value).digest();
export function adminConfigured() {
  return Boolean(
    process.env.ADMIN_PASSWORD_HASH ||
    (process.env.ADMIN_PASSWORD && process.env.ADMIN_PASSWORD.length >= 12),
  );
}
export function verifyCredentials(username: string, password: string) {
  if (!adminConfigured() || username.length > 100 || password.length > 256) return false;
  const userMatches = timingSafeEqual(hash(username), hash(process.env.ADMIN_USERNAME || 'admin'));
  let passwordMatches = false;
  if (process.env.ADMIN_PASSWORD_HASH) {
    const [algorithm, salt, expected] = process.env.ADMIN_PASSWORD_HASH.split(':');
    if (algorithm === 'scrypt' && salt && /^[a-f0-9]{128}$/.test(expected || ''))
      passwordMatches = timingSafeEqual(
        scryptSync(password, salt, 64),
        Buffer.from(expected, 'hex'),
      );
  } else passwordMatches = timingSafeEqual(hash(password), hash(process.env.ADMIN_PASSWORD!));
  return userMatches && passwordMatches;
}
export async function createSession(username: string, secure: boolean) {
  const token = randomBytes(32).toString('base64url');
  const now = Date.now();
  await withStore(
    (data) => {
      data.sessions = data.sessions.filter((s) => s.expiresAt > now);
      data.sessions.push({
        tokenHash: hash(token).toString('hex'),
        username,
        createdAt: now,
        expiresAt: now + 8 * 3600000,
      });
    },
    ['sessions'],
  );
  return {
    token,
    options: { httpOnly: true, secure, sameSite: 'strict' as const, path: '/', maxAge: 8 * 3600 },
  };
}
export async function getSession(token?: string) {
  if (!token || !/^[A-Za-z0-9_-]{43}$/.test(token) || !adminConfigured()) return null;
  const tokenHash = hash(token).toString('hex');
  return withStore(
    (data) =>
      data.sessions.find((s) => s.tokenHash === tokenHash && s.expiresAt > Date.now()) || null,
  );
}
export async function requireAdmin(request: NextRequest) {
  const session = await getSession(request.cookies.get(SESSION_COOKIE)?.value);
  if (!session) throw new ApiError(401, 'Administrator sifatida kiring.');
  return session;
}
export async function deleteSession(token?: string) {
  if (!token) return;
  const tokenHash = hash(token).toString('hex');
  await withStore(
    (data) => {
      data.sessions = data.sessions.filter((s) => s.tokenHash !== tokenHash);
    },
    ['sessions'],
  );
}
const globalLimits = globalThis as unknown as {
  ischiLimits?: Map<string, { count: number; until: number }>;
};
export function rateLimit(request: NextRequest, scope: string, max = 30, windowMs = 600000) {
  const limits = (globalLimits.ischiLimits ??= new Map());
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'local';
  const now = Date.now();
  if (limits.size > 10000)
    for (const [key, value] of limits) if (value.until < now) limits.delete(key);
  const key = scope + ':' + hash(ip).toString('hex');
  let bucket = limits.get(key);
  if (!bucket || bucket.until < now) {
    bucket = { count: 0, until: now + windowMs };
    limits.set(key, bucket);
  }
  if (++bucket.count > max)
    throw new ApiError(429, 'Juda ko‘p so‘rov. Birozdan so‘ng qayta urinib ko‘ring.');
}
export function allowedOrigin(request: NextRequest, admin = false) {
  const origin = request.headers.get('origin');
  const host =
    request.headers.get('x-forwarded-host')?.split(',')[0]?.trim() ||
    request.headers.get('host') ||
    request.nextUrl.host;
  const configured = (process.env.PUBLIC_WEB_ORIGIN || '')
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean);
  const mobile = ['https://localhost', 'capacitor://localhost', 'http://localhost'];
  return {
    origin,
    allowed:
      !origin ||
      (() => {
        try {
          return (
            new URL(origin).host === host ||
            configured.includes(origin) ||
            (!admin && mobile.includes(origin))
          );
        } catch {
          return false;
        }
      })(),
  };
}
export function assertOrigin(request: NextRequest, admin = false) {
  const { origin, allowed } = allowedOrigin(request, admin);
  if (!allowed || request.headers.get('sec-fetch-site') === 'cross-site' || (admin && !origin))
    throw new ApiError(403, 'So‘rov manbasi rad etildi.');
}
