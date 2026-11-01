import { createHash } from 'node:crypto';
import { cookies } from 'next/headers';
import { adminConfigured, SESSION_COOKIE } from './auth';
import { getDb } from './db';
export async function pageAdmin() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token || !/^[A-Za-z0-9_-]{43}$/.test(token) || !adminConfigured()) return null;
  const tokenHash = createHash('sha256').update(token).digest('hex');
  const session = getDb()
    .prepare('SELECT username FROM admin_sessions WHERE token_hash = ? AND expires_at > ?')
    .get(tokenHash, Date.now()) as { username: string } | undefined;
  return session || null;
}
