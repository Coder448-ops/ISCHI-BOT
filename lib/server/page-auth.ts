import { createHash } from 'node:crypto';
import { cookies } from 'next/headers';
import { adminConfigured, SESSION_COOKIE } from './auth';
import { dbGet } from './db';

export async function pageAdmin() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token || !/^[A-Za-z0-9_-]{43}$/.test(token) || !adminConfigured()) return null;
  const tokenHash = createHash('sha256').update(token).digest('hex');
  const session = await dbGet<{ username: string }>(
    'SELECT username FROM admin_sessions WHERE token_hash = ? AND expires_at > ?',
    [tokenHash, Date.now()],
  );
  return session || null;
}
